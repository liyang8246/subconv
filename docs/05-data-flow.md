# 数据处理流程详解

## 完整请求生命周期

以下是 `/sub` 接口一次完整的请求处理流程：

```
┌──────────────────────────────────────────────────────────────┐
│ 1. HTTP 请求                                                 │
│    GET /sub?target=clash&url=https%3A%2F%2Fexample.com/sub   │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. WebServer 路由匹配（webserver_httplib.cpp）                │
│    → 匹配到 /sub 路由 → 调用 subconverter()                   │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. 参数解析（interfaces.cpp - subconverter()）                │
│    ├── target = clash                                        │
│    ├── url = https://example.com/sub                         │
│    ├── emoji = true（默认）                                  │
│    ├── exclude = (到期|剩余流量|...)                          │
│    └── ...（30+ 可选参数）                                   │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. 订阅获取（webget.cpp - webGet()）                          │
│    ├── 使用 libcurl 发起 HTTP 请求                            │
│    ├── 支持多条订阅用 | 分隔，逐条请求                         │
│    ├── 支持 data URI                                          │
│    └── 缓存检查（如果启用）                                    │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. 订阅解析（subparser.cpp - subparser::parse()）             │
│    ├── 自动检测源格式（Base64？JSON？YAML？分享链接？）         │
│    ├── 按协议类型分流解析：                                   │
│    │   ├── SS: base64 decode → SIP002 / 传统格式             │
│    │   ├── SSR: 带 obfs 参数的 SS 扩展                       │
│    │   ├── VMess: base64 decode → JSON → 节点                │
│    │   ├── Trojan: 分享链接 / JSON 格式                      │
│    │   ├── Clash: YAML → proxies 提取                        │
│    │   ├── Surge: 配置节解析                                  │
│    │   └── ...                                               │
│    └── 输出统一的 NodeList（节点列表）                        │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. 节点处理流水线（nodemanip.cpp）                             │
│                                                              │
│    6a. 预过滤（include / exclude 正则匹配）                    │
│        ↓                                                     │
│    6b. JS 过滤（filter_script，如果启用）                      │
│        ↓                                                     │
│    6c. 重命名（rename 规则 + rename_node 配置）                │
│        ├── 正则替换：中国→中，×2→-2x                         │
│        └── JS 脚本：根据 IP 地理位置改名                       │
│        ↓                                                     │
│    6d. 插入节点（insert_url 配置的节点）                       │
│        ↓                                                     │
│    6e. 排序（sort_flag / sort_script）                        │
│        ↓                                                     │
│    6f. Emoji 添加（emoji 规则匹配）                            │
│        └── 日本→🇯🇵，香港→🇭🇰，美国→🇺🇸                       │
│        ↓                                                     │
│    6g. 附加信息（append_type：添加 [SS] 前缀等）              │
│        ↓                                                     │
│    6h. 过滤不支持节点（filter_deprecated_nodes）              │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. 配置生成（subexport.cpp - exportToXX()）                    │
│                                                              │
│    7a. 加载 base 模板（clash_rule_base / xx_rule_base）       │
│        └── all_base.tpl（inja 模板）                          │
│                                                              │
│    7b. 加载规则集（ruleset 配置）                             │
│        ├── 从本地/URL 获取规则片段                             │
│        ├── 支持 Surge/QuanX/Clash-domain/Clash-ipcidr 格式    │
│        └── 支持内联规则（[]GEOIP,CN / []FINAL 等）            │
│                                                              │
│    7c. 构建策略组（proxy_group 配置）                         │
│        ├── select（手动选择）                                  │
│        ├── url-test（自动测速）                                │
│        ├── fallback（故障转移）                                │
│        └── load-balance（负载均衡）                            │
│                                                              │
│    7d. Inja 模板渲染                                          │
│        ├── 填充配置参数                                       │
│        ├── 条件判断（if target == clash）                      │
│        └── 插入 proxies/proxy-groups/rules                    │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. 后处理与输出                                              │
│    ├── 添加 managed-config 信息（Surge）                      │
│    ├── 添加用户信息（流量/到期时间）                           │
│    ├── 可选：上传到 Gist（upload.cpp）                        │
│    └── 返回生成的配置文本                                     │
└──────────────────────────────────────────────────────────────┘
                       ▼
                  客户端收到配置
```

## 多订阅合并流程

当 `url` 参数包含多条订阅（用 `|` 分隔）时：

```
url=https://sub1.example.com|https://sub2.example.com
         │                      │
         ▼                      ▼
    webGet(sub1)           webGet(sub2)
         │                      │
         ▼                      ▼
    subparser.parse()     subparser.parse()
         │                      │
         ▼                      ▼
    NodeList(sub1)        NodeList(sub2)
         │                      │
         └──────────┬───────────┘
                    ▼
            NodeList(merged)
                    │
            GROUPID=0 节点 ← 第一条订阅
            GROUPID=1 节点 ← 第二条订阅
                    │
              正常流水线
```

## 规则集加载流程

```
ruleset 配置（pref.ini / 外部配置）
  │
  ├── ruleset=🎯 全球直连,LocalAreaNetwork.list        → 本地文件
  ├── ruleset=🛑 广告拦截,https://.../BanAD.list      → 远程 URL
  ├── ruleset=🎯 全球直连,[]GEOIP,CN                  → 内联规则
  └── ruleset=🐟 漏网之鱼,[]FINAL                     → 内联规则
         │
         ▼
    refreshRulesets()
      ├── 下载/读取所有规则文件
      ├── 缓存管理（判断是否过期）
      ├── 解析规则内容
      └── 生成 RulesetContent 列表
         │
         ▼
    在 subexport 中：
      ├── overwrite_original_rules ?
      │   ├── true  → 完全使用自定义规则集
      │   └── false → 追加到 base 模板规则之后
      └── 按顺序组合规则
```

## 策略组匹配流程

```ini
custom_proxy_group=🚀 节点选择`select`[]♻️ 自动选择`[]🎯 全球直连`.*
custom_proxy_group=♻️ 自动选择`url-test`.*`http://www.gstatic.com/generate_204`300,,50
```

1. `🚀 节点选择` 是一个 `select` 类型组
2. 组内成员：
   - `[]♻️ 自动选择` → 引用另一个策略组
   - `[]🎯 全球直连` → 引用 DIRECT
   - `.*` → 所有节点（正则匹配节点名）
3. `♻️ 自动选择` 是 `url-test` 类型组：
   - 所有节点参与测速
   - 测试 URL: `http://www.gstatic.com/generate_204`
   - 间隔 300s，切换容差 50ms

## 模板渲染流程

```
base 模板文件（如 all_base.tpl）
  │
  ├── {% if request.target == "clash" %}  → 模板引擎根据参数条件渲染
  ├── {{ global.clash.port }}             → 从 pref 配置取值
  ├── {{ local.clash.dns }}               → 从外部配置取值
  └── {% include "xxx.tpl" %}            → 引入子模板
        │
        ▼
  生成的配置文本中会包含占位符：
  __PROXIES__     → 将被替换为节点列表
  __PROXY_GROUP__ → 将被替换为策略组
  __RULESET__     → 将被替换为规则集
        │
        ▼
  subexport.cpp 中字符串替换：
  config = replace(config, "__PROXIES__", proxies_str);
  config = replace(config, "__PROXY_GROUP__", groups_str);
  config = replace(config, "__RULESET__", rules_str);
        │
        ▼
  最终配置输出
```

## Gist 上传流程

```
1. 请求包含 &upload=true
2. upload.cpp 读取 gistconf.ini 中的 Personal Access Token
3. 检查是否有已存在的 Gist ID（用于更新）
4. 调用 GitHub Gist API：
   POST https://api.github.com/gists
   {
     "description": "subconverter generated config",
     "public": false,
     "files": {
       "config.yaml": {
         "content": "生成的配置内容..."
       }
     }
   }
5. 返回 Raw URL
```
