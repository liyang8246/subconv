# 前后端一体化 Serverless 重构指南

## 当前架构的问题

### 痛点分析

| 问题 | 说明 |
|------|------|
| **架构割裂** | 前端 sub-web (Vue.js) 和后端 subconverter (C++) 是两个独立项目，部署繁琐 |
| **部署复杂** | C++ 后端需要编译，跨平台构建麻烦，在 serverless 环境无法直接运行 |
| **扩展性差** | C++ 单体服务，难以水平扩展，每次请求独占线程 |
| **状态管理** | 本地文件缓存、Gist 上传等强依赖本地文件系统 |
| **维护成本** | C++20 + QuickJS + inja 等技术栈现代但小众 |
| **缺乏 UI** | sub-web 功能有限，无法全面展示配置选项 |

## Serverless 重构目标架构

```
┌─────────────────────────────────────────────────────┐
│                 一体化 Serverless 应用                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ 前端 UI  │  │ API 层   │  │ 无状态转换引擎    │  │
│  │ (React/  │→ │ (Next.js │→ │ (JavaScript/     │  │
│  │  Vue)    │  │  API/    │  │  TypeScript)     │  │
│  │          │  │  Hono)   │  │                   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│       │              │               │              │
│       ▼              ▼               ▼              │
│  ┌──────────────────────────────────────────────┐   │
│  │         边缘缓存 / CDN / KV 存储              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
        │                ▲
        ▼                │
  用户设备          外部 API（机场订阅、规则源）
```

## 技术选型建议

### 框架选择

| 方案 | 适合场景 | 说明 |
|------|---------|------|
| **Next.js** (App Router) | 全栈一体化 | API Routes + React 前端，Vercel 部署 |
| **Hono** | 轻量 API | 支持 Cloudflare Workers / Deno / Bun |
| **Nuxt 3** | Vue 生态 | 如果你喜欢 Vue，API Routes + SSR |

### Serverless 平台

| 平台 | 优势 | 注意 |
|------|------|------|
| **Vercel** | Next.js 原生支持，Edge Functions | 函数超时 10s(Pro 60s) |
| **Cloudflare Workers** | 全球边缘，免费额度高 | 无文件系统，需 KV/R2 |
| **Deno Deploy** | 原生 TypeScript，快速 | 生态较小 |
| **AWS Lambda** | 成熟稳定 | 配置复杂 |

### 存储方案

| 用途 | serverless 方案 | 说明 |
|------|----------------|------|
| 配置文件 | KV / 对象存储 | 替代本地 pref.ini |
| 规则缓存 | KV / CDN | 替代本地文件缓存 |
| 订阅缓存 | KV + TTL | 替代内存缓存 |
| Gist 上传 | 直接调用 GitHub API | 保持现有功能 |

## 核心转换引擎重构

### 需要重写的核心模块

| 原 C++ 模块 | JS/TS 替代方案 | 说明 |
|------------|---------------|------|
| subparser.cpp | 自定义 parser | 解析 SS/SSR/VMess/Trojan/Clash 等格式 |
| subexport.cpp | 模板引擎 + 代码逻辑 | 生成目标格式配置 |
| nodemanip.cpp | 字符串操作 + regex | 节点过滤/重命名/排序 |
| ruleconvert.cpp | 字符串处理 | 规则格式互转 |
| webget.cpp | fetch / axios | HTTP 下载 |
| QuickJS | 直接使用 JS | 用户脚本天然支持 |
| inja 模板 | 任意 JS 模板引擎（Handlebars / EJS / 自定义） | 模板渲染 |

### 关键算法实现

#### 1. 订阅解析

```typescript
// 协议检测与解析
function detectAndParse(content: string): Node[] {
  if (isBase64(content)) {
    const decoded = base64Decode(content);
    if (isSSR(decoded)) return parseSSRLinks(decoded);
    if (isVmess(decoded)) return parseVmessLinks(decoded);
  }
  if (isYaml(content)) return parseClashConfig(content);
  if (isJson(content)) return parseV2rayConfig(content);
  if (isShareLink(content)) return parseShareLink(content);
  throw new Error('Unknown subscription format');
}
```

#### 2. 节点处理流水线

```typescript
interface Node {
  remark: string;
  server: string;
  port: number;
  type: 'ss' | 'ssr' | 'vmess' | 'trojan' | 'hysteria2' | ...;
  // ... 协议特定字段
}

function processNodes(nodes: Node[], options: ProcessOptions): Node[] {
  let result = nodes;

  // 1. 过滤（exclude / include）
  if (options.exclude) {
    const re = new RegExp(options.exclude);
    result = result.filter(n => !re.test(n.remark));
  }

  // 2. JS 过滤脚本
  if (options.filterScript) {
    const filterFn = new Function('node', options.filterScript);
    result = result.filter(n => filterFn(n));
  }

  // 3. 重命名
  if (options.rename) {
    result = result.map(n => ({
      ...n,
      remark: applyRename(n.remark, options.rename)
    }));
  }

  // 4. 排序
  if (options.sortFlag) {
    result.sort((a, b) => a.remark.localeCompare(b.remark));
  }

  // 5. 添加 Emoji
  if (options.addEmoji) {
    result = result.map(n => ({
      ...n,
      remark: addEmoji(n.remark, options.emojiRules)
    }));
  }

  return result;
}
```

#### 3. 配置生成（简化版）

```typescript
function generateClashConfig(params: GenerateParams): string {
  const { nodes, rulesets, proxyGroups, template } = params;

  const proxies = nodes.map(n => nodeToClashProxy(n));
  const groups = buildProxyGroups(proxies, proxyGroups);
  const rules = flattenRulesets(rulesets);

  // 用模板引擎渲染
  return renderTemplate(template, {
    proxies,
    'proxy-groups': groups,
    rules,
    port: params.port || 7890,
    // ...
  });
}
```

## API 设计（serverless 版）

### 核心接口

```typescript
// /api/sub - 订阅转换
POST /api/sub
{
  target: 'clash' | 'surge' | 'quanx' | ...,
  url: string | string[],       // 订阅链接
  config?: string,              // 外部配置 URL
  emoji?: boolean,
  exclude?: string,             // regex
  include?: string,             // regex
  rename?: RenameRule[],
  udp?: boolean,
  tfo?: boolean,
  // ... 其他参数
}

// /api/getruleset - 规则转换
POST /api/getruleset
{
  type: 1 | 2 | 3 | 4 | 6,
  url: string,
  group?: string,
}

// /api/configs - 配置管理
GET  /api/configs              // 列出预置配置
POST /api/configs              // 创建配置
GET  /api/configs/:id          // 获取配置详情
PUT  /api/configs/:id          // 更新配置

// /api/cache/clear - 缓存管理
POST /api/cache/clear
{
  type: 'ruleset' | 'subscription' | 'all',
  token: string,
}
```

## 前端 UI 设计建议

### 核心页面

1. **订阅转换页**
   - 订阅 URL 输入（支持多条）
   - 目标格式选择（Clash/Surge/QuanX/...）
   - 配置方案选择（ACL4SSR 的各种预制方案）
   - 高级选项展开（Emoji/TFO/UDP/过滤/重命名）
   - "生成"按钮 → 预览/下载/复制

2. **规则管理页**
   - 规则集状态查看
   - 自定义规则上传/编辑
   - 规则预览

3. **配置方案页**
   - 管理自定义配置方案
   - 分享配置方案（支持导入导出）

4. **API 文档页**
   - 交互式 API 文档
   - 一键测试

## 数据迁移

### ACL4SSR 规则集的迁移

ACL4SSR 的 `.list` 和 `.acl` 规则文件本身是纯文本，无需迁移。在 serverless 版本中：

1. **规则碎片引用**: 保留指向 GitHub raw 的 URL，或内嵌到代码中
2. **规则解析**: 需要实现 Surge 规则语法解析器（目前由 subconverter 完成）
3. **规则缓存**: 用 KV/对象存储替代本地文件缓存

### subconverter 配置迁移

```
pref.ini  →  环境变量 / 配置文件
  ├── [common]    →  顶层配置对象
  ├── [node_pref] →  转换选项
  ├── [emojis]    →  Emoji 规则数组
  ├── [ruleset]   →  规则集配置
  ├── [proxy_group] → 策略组定义
  └── [server]    →  运行时配置（不迁移）
```

## 注意事项和挑战

### 1. 无状态设计
- **不依赖本地文件系统**: 所有数据通过 HTTP/存储服务获取
- **请求级别清理**: 每个请求独立处理，不残留状态
- **外部化配置**: 配置存储在 KV/数据库，而非本地 .ini 文件

### 2. 冷启动优化
- **规则集预加载**: 部署时/启动时缓存常用规则集
- **CDN 分发**: 静态规则通过 CDN 加速
- **懒加载**: 大型规则集按需加载

### 3. 超时处理
- serverless 函数有执行时间限制（Vercel 10s/60s）
- 大规则集异步处理：提交 → 轮询结果
- 考虑使用队列处理耗时任务

### 4. 缓存策略
```typescript
const CACHE_TTL = {
  ruleset: 21600,        // 6 小时
  subscription: 60,       // 1 分钟
  externalConfig: 300,    // 5 分钟
};

async function getWithCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await kv.get(key);
  if (cached) return JSON.parse(cached);
  const data = await fetcher();
  await kv.set(key, JSON.stringify(data), { ttl });
  return data;
}
```

### 5. 安全性
- **Token 验证**: 敏感接口需验证 token
- **请求频率限制**: 防止滥用
- **URL 白名单**: 可选限制允许转换的订阅源
- **CORS 配置**: 允许自部署前端访问

## 建议的下一步行动

1. **在 JS/TS 中实现核心解析器**（subparser）
   - 先实现 SS/SSR/VMess/Trojan 四种最常用协议
   - 支持 Base64、YAML、JSON 三种容器格式

2. **搭建基础 API 框架**
   - 选择一个 serverless 框架（Next.js / Hono）
   - 实现 `/api/sub` 的 MVP 版本
   - 仅支持 target=clash，使用内置规则集

3. **移植一个外部配置方案**
   - 从 `ACL4SSR_Online_Mini.ini` 开始（最简单）
   - 实现 ruleset 加载和 proxy_group 构建

4. **前端 MVP**
   - URL 输入 + 目标格式选择 + 生成按钮
   - 显示生成的配置内容
   - 复制到剪贴板功能

5. **渐进增强**
   - 添加更多目标格式（surge, quanx, loon）
   - 添加 Emoji / 重命名 / 过滤功能
   - 添加配置方案管理
   - 添加缓存层
   - 用户自定义策略组（高级功能）
