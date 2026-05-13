# ACL4SSR 规则集详解

## 规则体系总览

ACL4SSR 维护了一个**多层次、多渠道**的规则体系，覆盖了代理分流所需的几乎所有场景。

## SSR ACL 规则

`.acl` 文件是 SSR/SS 客户端直接使用的规则格式，具有以下规则段：

```
[proxy_all]              # ← 默认代理（规则匹配失败时走代理）
[bypass_all]             # ← 默认直连
[outbound_block_list]    # ← 禁止访问列表（广告、跟踪器）
[bypass_list]            # ← 直连列表
[proxy_list]             # ← 代理列表
[remote_dns]             # ← 远程 DNS 列表
```

### 各 `.acl` 文件的策略差异

| 文件 | 默认策略 | 去广告 | 国内IP | 国内域名 | 国外 |
|------|---------|--------|--------|----------|------|
| `banAD.acl` | 代理 | ✅ | 直连 | 常用直连 | 代理+增强 |
| `onlybanAD.acl` | 代理 | ✅ | 无 | 无 | 全代理 |
| `nobanAD.acl` | 代理 | ❌ | 直连 | 常用直连 | 全代理 |
| `backcn-banAD.acl` | 代理 | ✅ | 代理 | 无 | GFW列表 |
| `gfwlist-banAD.acl` | 直连 | ✅ | 无 | 无 | GFW列表 |
| `fullgfwlist.acl` | 直连 | ❌ | 无 | 无 | GFW全量 |
| `easylist-banAD.acl` | 代理 | ✅ | 无 | 无 | 代理 |

## Clash 规则碎片

`.list` 文件使用 Surge 风格的规则语法（subconverter 的规则集也使用此格式）：

```list
# 域名规则
DOMAIN,example.com                    # 精确匹配
DOMAIN-SUFFIX,example.com             # 后缀匹配（*.example.com + example.com）
DOMAIN-KEYWORD,example                # 关键字匹配

# IP 规则
IP-CIDR,192.168.0.0/16               # IPv4 段
IP-CIDR6,::1/128                      # IPv6 段
IP-ASN,12345                          # ASN 号

# 其他
GEOIP,CN                              # GeoIP 国家代码
SRC-IP-CIDR,10.0.0.0/8               # 源 IP 匹配
DST-PORT,443                          # 目标端口
PROCESS-NAME,curl                     # 进程名
MATCH                                 # 兜底（类似 FINAL）
```

### 规则文件分类

每个 `.list` 文件是一个独立的规则碎片，按类别组织：

#### 广告与隐私（4 个）
- **`BanAD.list`** (600行): 常见广告联盟、广告关键字，无副作用
- **`BanProgramAD.list`**: 应用内广告拦截（可能有副作用）
- **`BanEasyList.list`**: AdblockPlus EasyList
- **`BanEasyListChina.list`**: 中国区补充规则
- **`BanEasyPrivacy.list`**: 隐私追踪拦截

#### 直连规则（7+ 个）
- **`ChinaDomain.list`**: 国内知名网站域名（百度、阿里、腾讯等）
- **`ChinaCompanyIp.list`**: 国内云服务商 IP 段（阿里云、腾讯云等）
- **`ChinaIp.list` / `ChinaIpV6.list`**: IPIP 国内 IP 段数据库
- **`LocalAreaNetwork.list`**: 内网地址段
- **`Download.list`**: 下载专用域名
- **`GoogleCN.list`**: 谷歌在中国可直连的域名
- **`UnBan.list`**: 放行域名（防止误杀）

#### 代理规则（3 个）
- **`ProxyGFWlist.list`**: GFW 全量域名列表
- **`ProxyLite.list`**: 精简代理列表（常用被墙域名）
- **`ProxyMedia.list`**: 国外流媒体代理

#### 平台/公司规则（10+ 个）
- **`Apple.list`**: 苹果全系服务
- **`Microsoft.list`**: 微软全系服务
- **`OneDrive.list`**: OneDrive
- **`Bing.list`**: Bing 搜索
- **`Telegram.list`**: Telegram
- **`Netflix.list`**: Netflix
- **`GoogleCN.list`**: 谷歌中国

#### Ruleset 细分类（156 个文件）

`Clash/Ruleset/` 目录下有 156 个细粒度规则文件，覆盖：

| 类别 | 示例文件 |
|------|----------|
| **流媒体** | Netflix.list, DisneyPlus.list, HBO.list, Hulu.list, BBC.list, YouTube.list, AbemaTV.list |
| **AI 平台** | AI.list, OpenAi.list, Claude.list, ClaudeAI.list, Gemini.list |
| **游戏** | Steam.list, Epic.list, Nintendo.list, Sony.list, Blizzard.list, Origin.list |
| **社交** | Telegram.list, Twitter.list, Facebook.list, Instagram.list, Discord.list, Reddit.list |
| **中国互联网** | Alibaba.list, Tencent.list, ByteDance.list, Baidu.list, Sina.list, JD.list, MI.list |
| **开发工具** | Github.list, Docker.list, JetBrains.list, Developer.list, Scholar.list |
| **影音动画** | Bilibili.list, BilibiliHMT.list, Bahamut.list, KKTV.list, LiTV.list, ViuTV.list |
| **网盘下载** | OneDrive.list, Dubox.list, TeraBox.list, Pandownload.list |
| **音乐** | Spotify.list, NetEaseMusic.list, SoundCloud.list, TIDAL.list, Qobuz.list |
| **加密货币** | Binance.list, Crypto.list |
| **其他** | Zoom.list, TeamViewer.list, RemoteDesktop.list, PrivateTracker.list |

## Clash Provider 定义

`Clash/Providers/` 目录下的 `.yaml` 文件定义了 Clash proxy-provider / rule-provider 格式：

```yaml
# BanAD.yaml
payload:
  - 'DOMAIN-KEYWORD,admarvel'
  - 'DOMAIN-KEYWORD,admaster'
  # ...
```

以及 `Clash/Providers/Ruleset/` 下的另一种格式：

```yaml
# 标准 Clash rule-provider 格式
behavior: domain
type: http
url: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/Ruleset/Netflix.list"
path: ./ruleset/Netflix.list
interval: 86400
```

## subconverter 配置方案

`Clash/config/` 目录下的 33 个 `.ini` 文件是 AC4SSR 为 subconverter 预置的"外部配置"方案。

### 配置方案命名规则

```
ACL4SSR[_Online][_Full|_Mini|_AdblockPlus][_MultiMode|_NoAuto|_Fallback|_MultiCountry|_NoApple|_NoMicrosoft|_NoReject|_WithChinaIp|_WithGFW].ini
```

- `Online`: 使用在线规则（raw.githubusercontent.com）
- `Full`: 完整规则集，包含最全的策略组
- `Mini`: 精简规则集，减少规则数量
- `AdblockPlus`: 增强去广告
- `MultiMode`: 多区域节点分组（香港/台湾/日本/美国/新加坡/韩国）
- `MultiCountry`: 多国家节点分组
- `NoAuto`: 不包含自动测速组
- `Fallback`: 使用故障转移策略
- `NoApple` / `NoMicrosoft`: 排除苹果/微软分流
- `NoReject`: 不包含拒绝规则

### 一个典型配置的内部结构

以 `ACL4SSR_Online_Full_MultiMode.ini` 为例：

**规则集部分**（26 条 ruleset）：
```
🛑 广告拦截     → BanAD.list
🍃 应用净化     → BanProgramAD.list
📲 电报消息     → Telegram.list
💬 Ai平台      → AI.list, OpenAi.list
📹 油管视频     → YouTube.list
🎥 奈飞视频     → Netflix.list
📺 巴哈姆特     → Bahamut.list
🌍 国外媒体     → ProxyMedia.list
🌏 国内媒体     → ChinaMedia.list
🚀 节点选择     → ProxyGFWlist.list
🎯 全球直连     → LocalAreaNetwork.list, ChinaDomain.list, ChinaCompanyIp.list, GEOIP,CN
🐟 漏网之鱼     → FINAL
```

**策略组部分**（16 个 proxy_group）：
```
🚀 节点选择     → select (手动切换)
♻️ 自动选择     → url-test (自动测速)
🔯 故障转移     → fallback
🔮 负载均衡     → load-balance
🇭🇰 香港节点     → url-test (港/HK/HongKong)
🇯🇵 日本节点     → url-test (日/JP/日本)
🇺🇲 美国节点     → url-test (美/US/United States)
🇨🇳 台湾节点     → url-test (台/TW/Taiwan)
🇸🇬 狮城节点     → url-test (新加坡/SG)
🇰🇷 韩国节点     → url-test (韩/KR)
🎥 奈飞节点     → select (NF/奈飞/Netflix)
📲 电报消息     → select (node/auto/direct)
... 等
```

## 规则维护流程

ACL4SSR 的规则通过 `scripts/update_rules.py` 和 `scripts/rules_config.conf` 自动更新：

```
update_rules.py
  │
  ├── 从远程源拉取最新规则
  │   ├── GFWList（Google 被墙域名）
  │   ├── EasyList / EasyList China（广告过滤）
  │   ├── IPIP（国内 IP 段）
  │   └── 其他社区源
  │
  ├── 格式转换和合并
  │   ├── 去重
  │   └── 分类到对应 list 文件
  │
  └── 生成 ACL 规则
      ├── banAD.acl（合并屏蔽+代理+直连）
      └── gfwlist-banAD.acl（GFW 模式）
```

## 规则语法兼容性

| 规则类型 | SSR/SS | Clash | Surge | Quantumult X | Loon |
|----------|--------|-------|-------|-------------|------|
| DOMAIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| DOMAIN-SUFFIX | ✓ | ✓ | ✓ | ✓ | ✓ |
| DOMAIN-KEYWORD | ✓ | ✓ | ✓ | ✓ | ✓ |
| IP-CIDR | ✓ | ✓ | ✓ | ✓ | ✓ |
| GEOIP | ✓ | ✓ | ✓ | ✓ | ✓ |
| MATCH/FINAL | ✓ | ✓ | ✓ | ✓ | ✓ |
| 正则(.acl) | ✓ | ✗ | ✗ | ✗ | ✗ |
| HOST-SUFFIX | ✗ | ✗ | ✗ | ✓ | ✗ |
| User-Agent | ✗ | ✗ | ✓ | ✓ | ✓ |
| PROCESS-NAME | ✗ | ✓ | ✗ | ✗ | ✗ |
