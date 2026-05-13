# ACL4SSR Clash 规则重写器 — 最终方案

## 一条龙流程

```
输入：Clash 订阅 URL（可能多条 | 分隔，可能 Base64 编码）
  │
  ├─ 1. 下载原始内容
  ├─ 2. 如果是 Base64 → 解码
  ├─ 3. YAML 解析
  │     └─ 合并多条订阅的 proxies
  ├─ 4. 节点处理流水线（全部在 Clash YAML 层面，不关心协议内部）
  │     ├─ 过滤（exclude / include 正则匹配节点名）
  │     ├─ 重命名（subconverter 兼容的正则替换）
  │     ├─ 排序
  │     ├─ Emoji 添加
  │     └─ 节点属性覆写（udp / tfo / scv）
  ├─ 5. 丢弃原配置中的 proxy-groups 和 rules
  ├─ 6. 注入编译时生成的 ACL4SSR 规则和策略组
  └─ 7. 拼装成完整 Clash YAML 返回

输出：整洁 Clash 配置
```

## 架构总图

```
┌─────────────────────────────────────────────────────────────┐
│                     Nuxt 4 应用                               │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐ │
│  │ Frontend │───→│  API Server   │───→│  Conversion Engine  │ │
│  │ (Vue 3)  │    │ (Nitro)      │    │  (纯函数，无状态)   │ │
│  └──────────┘    └──────────────┘    └──────────┬──────────┘ │
│                                                  │           │
│                                       ┌──────────┴──────────┐│
│                                       │  Codegen Output      ││
│                                       │  (编译时生成)        ││
│                                       │  ┌────────────────┐ ││
│                                       │  │ .list → TS 数组 │ ││
│                                       │  │ .ini → TS 配置  │ ││
│                                       │  │ .acl → TS 规则  │ ││
│                                       │  └────────────────┘ ││
│                                       └─────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────┐
│  ACL4SSR (git submodule)│  ← master 分支，只读
│  rules/ACL4SSR/        │
│  ├── Clash/*.list      │  规则碎片
│  ├── Clash/config/*.ini│  配置方案
│  ├── Clash/Ruleset/*   │  细分类规则
│  ├── Clash/Providers/* │  Provider 定义
│  └── Acl/*.acl         │  SSR 规则
└────────────────────────┘
```

## 核心技术决策

### 1. ACL4SSR 作为 Git 子模块

```bash
# 项目根目录执行
git submodule add -b master https://github.com/ACL4SSR/ACL4SSR.git rules/ACL4SSR
```

- 固定指向 master 分支
- 更新规则：`git submodule update --remote rules/ACL4SSR`
- 构建时自动使用最新代码
- 无需网络请求规则文件

### 2. 编译时代码生成

**策略**：用脚本在 `nuxt prepare` / `postinstall` 阶段，将 ACL4SSR 的全部规则文件"预编译"成 TypeScript 文件。

**生成脚本** `scripts/codegen.ts`（用 Bun/tsx 运行）：

```
scripts/codegen.ts
  │
  ├── 扫描 rules/ACL4SSR/Clash/*.list
  │   └── 每条规则 → TS 数组元素 → server/codegen/rules.ts
  │       例: BanAD.list → export const banAD: Rule[] = [...]
  │
  ├── 解析 rules/ACL4SSR/Clash/config/*.ini
  │   └── 每个 .ini 的 [ruleset] + [proxy_group] → TS 配置方案
  │       → server/codegen/presets.ts
  │
  ├── 生成所有规则索引
  │   → server/codegen/index.ts（按文件名/类别导出）
  │
  └── 生成策略组引用映射
      → server/codegen/group-refs.ts
```

**示例输出** `server/codegen/rules.ts`：

```typescript
// ⚡ 此文件由 codegen 自动生成，不要手动修改
// 源文件: rules/ACL4SSR/Clash/BanAD.list
export const banAD: string[] = [
  'DOMAIN-KEYWORD,admarvel',
  'DOMAIN-KEYWORD,admaster',
  'DOMAIN-SUFFIX,09mk.cn',
  // ... ~600 条规则编译时内联
];

// 源文件: rules/ACL4SSR/Clash/Apple.list
export const apple: string[] = [
  'DOMAIN-SUFFIX,aaplimg.com',
  'DOMAIN-SUFFIX,apple.com',
  // ...
];
```

**示例输出** `server/codegen/presets.ts`：

```typescript
// 从 ACL4SSR/Clash/config/ACL4SSR_Online_Full_MultiMode.ini 生成
export const presetFullMulti: Preset = {
  name: '完整多模式',
  rules: [
    { group: '🎯 全球直连', file: 'LocalAreaNetwork' },
    { group: '🛑 广告拦截', file: 'BanAD' },
    { group: '📲 电报消息', file: 'Telegram' },
    { group: '💬 Ai平台',   file: 'AI' },
    { group: '💬 Ai平台',   file: 'OpenAi' },
    { group: '📹 油管视频', file: 'Ruleset/YouTube' },
    { group: '🎥 奈飞视频', file: 'Ruleset/Netflix' },
    { group: '🎯 全球直连', inline: 'GEOIP,CN' },
    { group: '🐟 漏网之鱼', inline: 'FINAL' },
    // ...
  ],
  groups: [
    { name: '🚀 节点选择', type: 'select', refs: ['♻️ 自动选择', '🔯 故障转移', '🇭🇰 香港节点', 'DIRECT'] },
    { name: '♻️ 自动选择', type: 'url-test', match: '.*', url: 'http://www.gstatic.com/generate_204', interval: 300 },
    { name: '🇭🇰 香港节点', type: 'url-test', match: '(港|HK|Hong Kong)', url: '...', interval: 300 },
    { name: '🇯🇵 日本节点', type: 'url-test', match: '(日|JP|日本)', url: '...', interval: 300 },
    // ...
  ]
};
```

### 3. Clash 协议处理策略

关键认识：**输入输出都是 Clash YAML，全部节点在 `proxies[]` 数组中已是标准格式**。不需要理解每种协议的内部结构。

```
Clash YAML 中一个节点长得这样：
{
  name: '🇯🇵 JP 东京 01',
  type: 'ss',            // ← Clash 支持的所有 type: ss|ssr|vmess|trojan|vless|hysteria2|tuic|snell|socks5|http|wireguard|anytls
  server: 'jp01.example.com',
  port: 443,
  cipher: 'aes-128-gcm',
  password: 'xxx',
  // ... 协议特定字段，全部透传
}
```

处理方式是**泛型透传**：

```typescript
// 泛型节点类型（覆盖 Clash 所有协议）
interface ClashProxy {
  name: string;
  type: string;        // 任何 Clash 支持的 type
  server: string;
  port: number;
  [key: string]: unknown;  // 其余字段通通透传
}

// 提取节点（只关心 name 和 type，其他透传）
function extractProxies(doc: any): ClashProxy[] {
  return doc.proxies || doc.Proxy || [];
}

// 输出节点（原样保留，只修改 name 和可能添加 udp/tfo 等公共字段）
function emitProxies(proxies: ClashProxy[]): ClashProxy[] {
  return proxies.map(p => ({
    ...p,                         // 所有协议特有字段原样保留
    name: processName(p.name),    // 重命名 + Emoji
    ...(udp ? { udp: true } : {}),
    ...(tfo ? { 'tfo': true } : {}),
  }));
}
```

这样**天然支持 Clash 未来的新协议**——只要 Clash 能解析，我们的工具就能透传。

### 4. 构建流程

```
npm install
  │
  ├─ git submodule update --init      # 拉取 ACL4SSR
  │
  └─ postinstall: scripts/codegen.ts   # 编译规则 → TS
       │
       ▼
nuxt prepare  /  nuxt build
       │
       ▼
  server/codegen/*.ts 已打包到 Nitro 产物中
       │
       ▼
  deploy (Vercel / 自部署)
```

### 5. 订阅处理逻辑

```typescript
// 输入：原始 URL 参数
// 可能的情况：
//   1. https://example.com/sub       → Clash YAML
//   2. https://example.com/sub       → Base64 文本（解码后是 Clash YAML）
//   3. url1|url2|url3                 → 多条订阅合并
//   4. 以上任意组合

async function resolveInput(urlParam: string): Promise<ClashProxy[]> {
  const urls = urlParam.split('|');
  const allProxies: ClashProxy[] = [];

  for (const rawUrl of urls) {
    const decodedUrl = decodeURIComponent(rawUrl.trim());
    let text = await fetchSubscription(decodedUrl);
    
    // 判断是否是 Base64
    if (looksLikeBase64(text)) {
      text = base64Decode(text);
    }
    
    // 判断是否是 YAML
    if (!looksLikeYaml(text)) {
      text = base64Decode(text); // 可能是双层 Base64
    }
    
    const doc = yaml.parse(text);
    const proxies = extractProxies(doc);
    allProxies.push(...proxies);
  }
  
  return allProxies;
}
```

### 6. 零数据库、零运行时依赖

| 传统做法 | 本方案 |
|----------|--------|
| 运行时从 GitHub raw 下载规则 | ❌ 编译时已内联 |
| KV/Redis 缓存规则 | ❌ 不需要 |
| 本地文件系统存储 | ❌ 不需要 |
| 数据库存配置方案 | ❌ TypeScript 常量 |
| 定时任务更新规则 | ❌ 重新部署即可 |

**server 层的所有 import 都是本地 codegen 产物，无外部 I/O。**

### 7. 技术栈

```
Nuxt 4             框架（已正式 release）
Vue 3              前端框架
TypeScript         全栈类型
yaml (Eemeli)      YAML 解析/序列化
nuxt/eslint        Nuxt 官方 lint 配置
Tailwind CSS v4    UI 样式（可选）
tsx / bun          运行 codegen 脚本
```

`nuxt/eslint` 配置方式：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityVersion: 4,
  modules: ['@nuxt/eslint'],
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
```

### 8. 输入输出边界

| 场景 | 是否支持 |
|------|---------|
| Clash YAML → Clash YAML | ✅ |
| Base64 编码的 Clash YAML → Clash YAML | ✅ |
| 多条订阅合并 | ✅ |
| 机场原始规则丢弃，替换为 ACL4SSR | ✅ |
| 节点按名称过滤 | ✅ |
| 节点重命名 / Emoji | ✅ |
| udp/tfo/scv 全局开关 | ✅ |
| 任何 Clash 协议类型透传 | ✅ (ss/ssr/vmess/trojan/vless/hysteria2/tuic/snell/socks5/http/wireguard/anytls) |
| 非 Clash 格式输入 | ❌ (明确不支持) |

### 9. 项目依赖总结

```jsonc
{
  "dependencies": {
    "yaml": "^2.x"            // YAML 解析 + 序列化（唯一运行时依赖）
  },
  "devDependencies": {
    "nuxt": "^4.x",
    "@nuxt/eslint": "^1.x",
    "vue": "latest",
    "typescript": "latest",
    // codegen 脚本需要：
    "tsx": "^4.x"             // 运行 TypeScript codegen 脚本
  }
}
```

### 10. 命名建议

```
项目名: aclssr-clash 或 clash-cleaner 或 cnv
描述: Clash subscription reformatter with ACL4SSR rules (Nuxt 4)
```
