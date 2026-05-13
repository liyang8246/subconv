# subconverter 后端深度解析

## 项目概况

subconverter 是一个用 C++20 编写的高性能代理订阅转换服务，支持 15 种以上的代理协议/工具之间的格式互转。

## 源码结构

```
subconverter/src/
├── main.cpp                          # 入口：CLI 参数解析、WebServer 路由注册、启动
├── version.h                         # 版本号
│
├── handler/                          # 业务逻辑层
│   ├── interfaces.h / .cpp           # API 处理函数（subconverter, getRuleset, getProfile, renderTemplate）
│   ├── settings.h / .cpp             # 全局配置加载与管理（Settings 结构体）
│   ├── multithread.h / .cpp          # 多线程下载
│   ├── upload.h / .cpp               # GitHub Gist 上传
│   └── webget.h / .cpp               # HTTP/HTTPS 下载（libcurl）
│
├── generator/                        # 配置生成引擎
│   ├── config/
│   │   ├── subexport.h / .cpp        # 核心：订阅导出到各种格式
│   │   ├── nodemanip.h / .cpp        # 节点操作（过滤、重命名、排序）
│   │   └── ruleconvert.h / .cpp      # 规则格式转换
│   └── template/
│       └── templates.h / .cpp        # Inja 模板引擎封装
│
├── parser/                           # 解析器
│   ├── subparser.h / .cpp            # 订阅解析（SS/SSR/VMess/Trojan 等）
│   └── infoparser.h / .cpp           # 配置信息解析（INI/JSON）
│
├── script/                           # 脚本系统
│   ├── cron.h / .cpp                 # 定时任务
│   └── script_quickjs.h / .cpp       # QuickJS JavaScript 引擎集成
│
├── server/                           # HTTP 服务器
│   ├── webserver.h                   # Web 服务器接口（Request/Response 定义）
│   ├── webserver_httplib.cpp         # cpp-httplib 实现
│   ├── webserver_libevent.cpp        # libevent 实现（已注释）
│   └── socket.h                      # Socket 工具
│
├── config/                           # 配置数据结构
│   ├── ruleset.h                     # 规则集管理
│   ├── proxygroup.h                  # 策略组配置
│   ├── regmatch.h                    # 正则匹配配置
│   └── crontask.h                    # 定时任务配置
│
├── utils/                            # 工具库
│   ├── base64/                       # Base64 编解码
│   ├── md5/                          # MD5 哈希
│   ├── string.h / .cpp               # 字符串工具
│   ├── network.h / .cpp              # 网络工具
│   ├── urlencode.h / .cpp            # URL 编解码
│   ├── regexp.h / .cpp               # 正则封装（PCRE2）
│   ├── file.h / .cpp                 # 文件 I/O
│   ├── logger.h / .cpp               # 日志系统
│   ├── system.h / .cpp               # 系统工具
│   ├── codepage.h / .cpp             # 编码转换
│   ├── ini_reader/                   # INI 文件解析
│   └── ...（其他工具头文件）
│
└── lib/                              # 静态库包装（BUILD_STATIC_LIBRARY 时使用）
    └── wrapper.cpp
```

## 核心 API 详解

### 1. `/sub` - 订阅转换（主入口）

```cpp
// interfaces.cpp -> subconverter() 函数
webServer.append_response("GET", "/sub", "text/plain;charset=utf-8", subconverter);
webServer.append_response("HEAD", "/sub", "text/plain", subconverter);
```

**参数**（完整列表 30+ 个）：

| 参数 | 必需 | 说明 | 示例 |
|------|------|------|------|
| `target` | 是 | 目标格式 | clash, surge&ver=4, quanx, trojan, v2ray |
| `url` | 否* | 订阅链接（URL encoded，多条用 `\|` 分隔） | https%3A%2F%2F... |
| `config` | 否 | 外部配置 URL | https%3A%2F%2Fgist... |
| `emoji` | 否 | 是否加 Emoji 前缀 | true/false |
| `exclude` | 否 | 排除节点的正则 | (%E5%88%B0%E6%9C%9F) |
| `include` | 否 | 仅保留节点的正则 | (US\|美国) |
| `rename` | 否 | 重命名规则（URL encoded） | ... |
| `filter_script` | 否 | JS 过滤脚本 | ... |
| `sort_script` | 否 | JS 排序脚本 | ... |
| `tfo` | 否 | TCP Fast Open | true/false |
| `udp` | 否 | UDP 支持 | true/false |
| `list` | 否 | 输出纯节点列表 | true/false |
| `upload` | 否 | 上传到 Gist | true/false |

*\*: 当 `default_url` 已配置时 url 可选*

### 2. `/getruleset` - 规则转换

```cpp
webServer.append_response("GET", "/getruleset", "text/plain;charset=utf-8", getRuleset);
```

| 参数 | 必需 | 说明 |
|------|------|------|
| `type` | 是 | 目标类型：1=Surge, 2=Quantumult X, 3/4/6=Clash 变体 |
| `url` | 是 | 源规则链接（Base64 编码） |
| `group` | type=2 时 | 策略组名 |

### 3. `/getprofile` - 配置档案

```cpp
webServer.append_response("GET", "/getprofile", "text/plain;charset=utf-8", getProfile);
```

引用本地预存的配置档案（`.ini`），简化调用 URL。

### 4. `/render` - 模板渲染

```cpp
webServer.append_response("GET", "/render", "text/plain;charset=utf-8", renderTemplate);
```

直接渲染模板文件，用于调试或生成复杂配置。

### 5. 管理接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/version` | GET | 返回版本号 |
| `/refreshrules` | GET | 刷新规则集缓存（需 token） |
| `/readconf` | GET | 重新加载配置（需 token） |
| `/updateconf` | POST | 更新配置文件（需 token） |
| `/flushcache` | GET | 清除缓存（需 token） |

## 支持的代理协议格式

### 作为源格式（可解析）
- SS（SIP002 / 软件订阅 / SIP008）
- SSR
- VMess（v2rayN 标准 / 分享链接）
- Trojan（分享链接 / 配置文件）
- Clash / ClashR（YAML 配置）
- Quantumult / Quantumult X（完整配置）
- Surge 2/3/4
- Loon, Mellow, Surfboard, SSD
- TG 代理的 HTTP/Socks 链接

### 作为目标格式（可生成）
- 以上所有 + Mixed（多协议混合订阅）+ Auto（根据 UA 自动判断）

## 模板引擎（Inja）

subconverter 使用 [inja](https://github.com/pantor/inja) 模板引擎生成配置输出。`.tpl` 模板文件可以访问三个数据源：

```
global.*    # 从 pref 配置文件获取的值
local.*     # 从外部配置获取的值
request.*   # 从 URL 参数获取的值
```

**模板示例**：
```inja
# all_base.tpl（简化）
{% if request.target == "clash" or request.target == "clashr" %}
port: {{ global.clash.port }}
socks-port: {{ global.clash.socks_port }}
{% if default(request.clash.dns, "false") == "true" %}
dns:
  enabled: true
  listen: 1053
{% endif %}
{% endif %}
```

## JS 脚本系统（QuickJS）

嵌入 QuickJS 引擎实现自定义逻辑：

**节点过滤脚本**：
```javascript
function filter(node) {
    const info = JSON.parse(node.ProxyInfo);
    // 仅保留 chacha20 加密的节点
    return info.EncryptMethod.includes('chacha20');
}
```

**节点排序脚本**：
```javascript
function compare(node_a, node_b) {
    return node_a.Remark > node_b.Remark;
}
```

**重命名脚本**：
```javascript
function rename(node) {
    const geoinfo = JSON.parse(geoip(node.Hostname));
    if (geoinfo.country_code == "CN")
        return "CN " + node.Remark;
    return node.Remark;
}
```

## 配置系统

### 主配置文件（pref.ini）

```ini
[common]
api_mode = false
api_access_token = password
default_url =
exclude_remarks = (到期|剩余流量|时间|官网|产品|平台)
clash_rule_base = base/GeneralClashConfig.yml
base_path = base

[node_pref]
udp_flag = false
sort_flag = false

[emojis]
add_emoji = true
rule = (港|HK),🇭🇰
rule = (日|JP),🇯🇵
# ... 更多国家 Emoji

[ruleset]
enabled = true
ruleset = 🎯 全球直连,https://raw.githubusercontent.com/...

[proxy_group]
custom_proxy_group = 🚀 节点选择`select`...

[server]
listen = 0.0.0.0
port = 25500

[advanced]
log_level = info
max_concurrent_threads = 4
```

### 外部配置（`&config=` 引用的文件）

```ini
[custom]
custom_proxy_group=Proxy`select`.*`[]AUTO`[]DIRECT
ruleset=DIRECT,https://raw.githubusercontent.com/...
enable_rule_generator=true
overwrite_original_rules=true
clash_rule_base=base/forcerule.yml
add_emoji=true
exclude_remarks=(到期|流量)
```

## 构建系统

使用 CMake 构建，最低要求 C++20 标准：

```bash
cmake -B build
cmake --build build
```

支持命令行参数：
- `-cfw`: Clash for Windows 子进程模式，启用按需更新规则
- `-f <file>`: 指定配置文件路径
- `-g`: 本地生成模式（根据 generate.ini 生成文件后退出）
- `--artifact <name>`: 配合 `-g` 仅生成指定 artifacts
- `-l <file>`: 重定向日志输出

## 关键设计决策

1. **C++20 选择**: 追求极致性能，适合代理订阅这种高频调用场景
2. **嵌入式 JS**: QuickJS 允许用户在运行时动态注入过滤/排序逻辑，无需重新编译
3. **模板驱动**: Inja 将输出格式与逻辑解耦，易于适配新工具
4. **缓存系统**: 分订阅缓存（默认 60s）、配置缓存（300s）、规则集缓存（21600s）
5. **多线程**: 可配置最大线程数，异步下载规则集
