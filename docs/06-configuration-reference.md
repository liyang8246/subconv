# 配置参考手册

## subconverter 主配置（pref.ini）

### [common] 通用设置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `api_mode` | `false` | API 模式。true 时禁止直接加载本地订阅/文件，需 token |
| `api_access_token` | `password` | API 访问令牌，用于安全接口 |
| `default_url` | (空) | 默认订阅链接，URL 未提供时使用 |
| `exclude_remarks` | `(到期\|流量\|...)` | 排除节点名匹配正则的节点 |
| `include_remarks` | (空) | 仅保留节点名匹配正则的节点 |
| `enable_filter` | `false` | 启用 JS 节点过滤 |
| `filter_script` | (空) | JS 过滤脚本内容或路径 |
| `default_external_config` | (空) | 默认外部配置 URL 或路径 |
| `base_path` | `base` | 外部配置可引用的本地文件根路径 |
| `clash_rule_base` | `base/all_base.tpl` | Clash 配置模板 |
| `surge_rule_base` | `base/all_base.tpl` | Surge 配置模板 |
| `proxy_config` | `SYSTEM` | 更新配置时的代理 |
| `proxy_ruleset` | `SYSTEM` | 更新规则集时的代理 |
| `proxy_subscription` | `NONE` | 更新订阅时的代理 |
| `append_proxy_type` | `false` | 节点名前加 [SS] [VMess] 等 |

### [node_pref] 节点偏好

| 键 | 默认值 | 说明 |
|----|--------|------|
| `udp_flag` | `false` | 全局开启 UDP |
| `tcp_fast_open_flag` | `false` | 全局开启 TFO |
| `skip_cert_verify_flag` | `false` | 跳过 TLS 证书验证 |
| `tls13_flag` | `false` | 开启 TLS 1.3 |
| `sort_flag` | `false` | 按节点名 A-Z 排序 |
| `filter_deprecated_nodes` | `false` | 过滤目标不支持的节点类型 |
| `append_sub_userinfo` | `true` | 在 header 中加入流量信息 |
| `clash_use_new_field_name` | `true` | 使用新字段名(proxies/proxy-groups/rules) |
| `clash_proxies_style` | `flow` | proxies 风格：block/flow/compact |

### [emojis] Emoji 配置

| 键 | 说明 |
|----|------|
| `add_emoji` | 是否添加 Emoji 前缀 |
| `remove_old_emoji` | 是否移除原有 Emoji |
| `rule` | 匹配规则，格式：`pattern,emoji` |

示例：
```ini
[emojis]
add_emoji=true
remove_old_emoji=true
rule=(港|HK|香港),🇭🇰
rule=(日|JP|日本),🇯🇵
rule=(美|US|美国),🇺🇸
```

### [ruleset] 规则集

| 键 | 默认值 | 说明 |
|----|--------|------|
| `enabled` | `true` | 启用自定义规则集 |
| `overwrite_original_rules` | `false` | 覆盖 base 模板中的规则 |
| `update_ruleset_on_request` | `false` | 每次请求更新规则集 |

规则集引用格式：
```ini
[ruleset]
ruleset=策略组名,规则URL[,更新间隔]
ruleset=策略组名,type:规则URL[,更新间隔]
ruleset=策略组名,[]内联规则
```

类型（type）：
- `surge`（默认）: Surge DOMAIN 规则集
- `quanx`: Quantumult X 规则集
- `clash-domain`: Clash domain rule-provider
- `clash-ipcidr`: Clash ipcidr rule-provider
- `clash-classic`: Clash classical ruleset

### [proxy_group] 策略组

格式：
```ini
# select 类型
custom_proxy_group=组名`select`规则1`规则2`...

# url-test/fallback/load-balance 类型
custom_proxy_group=组名`类型`规则...`测试URL`间隔[,超时][,容差]
```

特殊筛选标记：
- `.*` — 所有节点
- `[]组名` — 引用另一个策略组
- `[]DIRECT` / `[]REJECT` / `[]AUTO` — 内置策略
- `!!GROUPID=n` — 第 n+1 条订阅的节点
- `!!INSERT=n` — insert_url 中第 n+1 条
- `!!PROVIDER=name` — 指定 proxy-provider
- `!!GROUP=tag` — 指定 tag 的订阅的节点
- `!!GROUPID=0!!(港|HK)` — 组合条件（AND）

### [server] 服务器设置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `listen` | `127.0.0.1` | 绑定地址（0.0.0.0 允许局域网） |
| `port` | `25500` | 监听端口 |
| `serve_file_root` | (空) | 静态文件根目录 |

### [advanced] 高级设置

| 键 | 默认值 | 说明 |
|----|--------|------|
| `log_level` | `info` | 日志级别 |
| `max_pending_connections` | `10` | 最大挂起连接数 |
| `max_concurrent_threads` | `4` | 最大线程数 |
| `max_allowed_rulesets` | `64` | 规则集数量上限 |
| `max_allowed_rules` | `32768` | 规则数量上限 |
| `max_allowed_download_size` | `1048576` | 下载文件大小上限(字节) |
| `enable_cache` | `false` | 启用缓存 |
| `cache_subscription` | `60` | 订阅缓存时间(秒) |
| `cache_config` | `300` | 配置缓存时间(秒) |
| `cache_ruleset` | `21600` | 规则集缓存时间(秒) |

## 外部配置（&config= 引用的文件）

外部配置的 `[custom]` 段可覆盖主配置的大部分设置：

```ini
[custom]
;策略组定义（覆盖 pref.ini 的 [proxy_group]）
custom_proxy_group=...

;规则集定义（覆盖 pref.ini 的 [ruleset]）
ruleset=...

;基础模板
clash_rule_base=...

;节点重命名
rename=...

;Emoji
add_emoji=true
emoji=...

;过滤
include_remarks=
exclude_remarks=

;模板变量
[template]
clash.dns.port=5353
```

## 规则列表格式参考

### Clash 规则列表（.list）
```
# 这是一条注释
DOMAIN,example.com
DOMAIN-SUFFIX,google.com
DOMAIN-KEYWORD,adservice
IP-CIDR,10.0.0.0/8
IP-CIDR6,::1/128,no-resolve
GEOIP,CN
SRC-IP-CIDR,192.168.1.0/24
DST-PORT,443
PROCESS-NAME,trojan
MATCH
```

### SSR ACL 格式（.acl）
```
[proxy_all]
[outbound_block_list]
(^|\.)ads\.example\.com$
[bypass_list]
(^|\.)baidu\.com$
[proxy_list]
(^|\.)google\.com$
[remote_dns]
```

### Clash Provider 格式（.yaml）
```yaml
# rule-provider
behavior: domain
type: http
url: "https://example.com/rules.txt"
path: ./rules/rules.txt
interval: 86400

# proxy-provider
type: http
url: "https://example.com/sub"
interval: 86400
health-check:
  enable: true
  url: http://www.gstatic.com/generate_204
  interval: 300
```

## 模板语法参考

subconverter 使用 [Inja](https://github.com/pantor/inja) 模板引擎：

```inja
{# 注释 #}

{# 取值 #}
{{ request.target }}
{{ global.clash.port }}
{{ local.clash.dns }}

{# 条件判断 #}
{% if request.target == "clash" %}
...Clash 专属配置...
{% endif %}

{# 条件带默认值 #}
{% if default(request.clash.dns, "false") == "true" %}
...启用 DNS...
{% endif %}

{# 容器类型判断 #}
{% if request.target in ["clash", "clashr"] %}
...适用于 Clash/ClashR...
{% endif %}

{# 循环 #}
{% for node in nodes %}
- {{ node.name }}
{% endfor %}
```

**内置变量前缀**：
- `request.*` — URL 参数
- `global.*` — pref 配置文件的值
- `local.*` — 外部配置的定义
