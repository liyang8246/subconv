# 系统架构分析

## 整体架构

当前项目是典型的前后端分离架构：

```
┌─────────────────────────────────────────────┐
│            Frontend (sub-web)                │
│         Vue.js + Element UI                  │
│    提供 Web 界面配置转换参数                  │
└──────────────────┬──────────────────────────┘
                   │ HTTP(s) 请求
                   ▼
┌─────────────────────────────────────────────┐
│       Backend (subconverter)                 │
│         C++20 HTTP Server                    │
│    监听 :25500（默认）                       │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │路由分发   │  │解析引擎   │  │模板渲染引擎 │ │
│  │(WebServer)│→│(Parser)  │→│(Inja)      │ │
│  └──────────┘  └──────────┘  └────────────┘ │
│       │              │              │        │
│       ▼              ▼              ▼        │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │规则管理   │  │节点过滤   │  │输出生成    │ │
│  │(Ruleset)  │  │(Filter/   │  │(SubExport) │ │
│  │           │  │ Sort/Ren) │  │            │ │
│  └──────────┘  └──────────┘  └────────────┘ │
└─────────────────────────────────────────────┘
```

## subconverter 后端架构

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| **WebServer** | `src/server/webserver.h` `webserver_httplib.cpp` | HTTP 服务器，路由注册与请求分发 |
| **Interfaces** | `src/handler/interfaces.cpp/.h` | API 处理函数（`/sub`, `/getruleset`, `/getprofile` 等） |
| **Settings** | `src/handler/settings.cpp/.h` | 配置加载（pref.ini/yml/toml），全局状态 |
| **SubExport** | `src/generator/config/subexport.cpp` | 核心转换逻辑，生成目标格式配置 |
| **NodeManip** | `src/generator/config/nodemanip.cpp` | 节点过滤、重命名、排序 |
| **RuleConvert** | `src/generator/config/ruleconvert.cpp` | 规则格式转换 |
| **Parser** | `src/parser/subparser.cpp`, `infoparser.cpp` | 解析各种代理协议的分享链接/订阅 |
| **Script** | `src/script/script_quickjs.cpp` | QuickJS 嵌入，JS 脚本过滤/排序 |
| **Cron** | `src/script/cron.cpp` | 定时任务系统 |
| **Templates** | `src/generator/template/templates.cpp` | Inja 模板引擎封装 |
| **WebGet** | `src/handler/webget.cpp` | HTTP 下载（libcurl） |
| **Upload** | `src/handler/upload.cpp` | Gist 自动上传 |
| **Multithread** | `src/handler/multithread.cpp` | 多线程下载管理 |

### 请求处理流程

以最常见的 `/sub` 接口为例：

```
1. HTTP 请求到达 → WebServer 路由匹配
2. → subconverter() 函数（interfaces.cpp）
3.   → 解析 URL 参数（target, url, emoji, exclude, rename, ...）
4.   → 获取订阅内容（webGet，支持多个订阅用 | 分隔）
5.   → subparser::parse() 解析各协议节点
6.   → 应用过滤规则（exclude_remarks / include_remarks）
7.   → 应用 JS filter_script（如果有）
8.   → 节点重命名（rename_node 规则）
9.   → 节点排序（sort_flag / sort_script）
10.  → 加载规则集（ruleset）
11.  → 构建策略组（proxy_group）
12.  → 加载模板（base 文件）
13.  → inja 模板渲染生成最终输出
14.  → 返回或上传到 Gist
```

### 配置加载层级

```
pref.ini / pref.yml / pref.toml（主配置，按优先级加载）
  │
  ├── 基础模板（clash_rule_base / surge_rule_base 等）
  │     └── all_base.tpl（inja 模板）
  │
  ├── 外部配置（通过 &config= 参数或 default_external_config）
  │     ├── config/ACL4SSR_Online.ini（ACL4SSR 预置方案）
  │     ├── ruleset（规则集引用）
  │     └── proxy_group（策略组定义）
  │
  └── URL 参数（覆盖配置中的设置）
        ├── target, url, emoji, exclude, include, rename, ...
        ├── tfo, udp, scv（节点属性覆盖）
        └── filter_script, sort_script（JS 脚本覆盖）
```

### 三个配置模式

1. **简易模式**: 只需 `target` + `url`，使用默认配置
2. **进阶模式**: 调用时附带大量 URL 参数（emoji, exclude, rename 等）
3. **档案模式**: 通过 `/getprofile` 引用预存在本地的 `.ini` 配置档案

## ACL4SSR 规则架构

### 规则格式体系

项目维护了三种主要格式的规则集：

#### 1. SSR ACL 格式（.acl）
```
[proxy_all]              # 默认代理
[outbound_block_list]    # 禁止访问（广告等）
(^|\.)\w*admarvel\w*\.\w*$   # 正则匹配域名
[bypass_list]            # 直连列表
(^|\.)baidu\.com$        # 直连域名
[proxy_list]             # 代理列表
(^|\.)google\.com$       # 代理域名
[remote_dns]             # 远程 DNS
```

#### 2. Clash 规则碎片（.list）
```
# Surge 风格规则语法
DOMAIN-SUFFIX,google.com    # 域名后缀匹配
DOMAIN-KEYWORD,google       # 域名关键字匹配
DOMAIN,www.google.com       # 精确域名匹配
IP-CIDR,1.2.3.4/24         # IP 段匹配
GEOIP,CN                    # GeoIP 国家匹配
MATCH                       # 兜底匹配（FINAL）
```

#### 3. Clash Provider 格式（.yaml）
```yaml
payload:
  - 'DOMAIN-SUFFIX,google.com'
  - 'DOMAIN-KEYWORD,google'
```

### 规则分类体系

ACL4SSR 的规则碎片按照"服务类别"和"地理位置"两个维度组织：

**服务类别维度**:
- 广告拦截：`BanAD.list`, `BanProgramAD.list`, `BanEasyList.list`
- 直连：`ChinaDomain.list`, `ChinaCompanyIp.list`, `LocalAreaNetwork.list`
- 代理：`ProxyGFWlist.list`, `ProxyLite.list`
- 流媒体：`Netflix.list`, `DisneyPlus.list`, `YouTube.list`
- 游戏：`Steam.list`, `Epic.list`, `Nintendo.list`
- 社交：`Telegram.list`, `Twitter.list`, `Facebook.list`
- AI：`AI.list`, `OpenAi.list`, `Claude.list`, `Gemini.list`

**地理位置维度**:
- 国内：`ChinaDomain.list`, `ChinaMedia.list`
- 国外：`ProxyMedia.list`
- 港澳台：`BilibiliHMT.list`, `Bahamut.list`

### subconverter 外部配置方案

在 `Clash/config/` 目录下有 33 套预置配置，命名规则：

```
ACL4SSR_Online.ini              # 在线完整版
ACL4SSR_Online_Full.ini         # 完整增强版
ACL4SSR_Online_Full_MultiMode.ini  # 完整多模式（含香港/台湾/日本/美国/新加坡 分区节点）
ACL4SSR_Online_Mini.ini         # 精简版
ACL4SSR_Online_Mini_MultiMode.ini  # 精简多模式
ACL4SSR_Online_NoAuto.ini       # 无自动测速
ACL4SSR_Online_AdblockPlus.ini   # AdblockPlus 增强去广告
```

每个配置文件定义了：
- `ruleset`：规则集引用（策略组名 → 规则文件 URL）
- `custom_proxy_group`：自定义策略组（节点选择 → 自动选择 → 区域节点分组）
- `enable_rule_generator` / `overwrite_original_rules`：规则生成控制

## 依赖关系

### subconverter 后端依赖

| 依赖 | 用途 | 版本要求 |
|------|------|----------|
| libcurl | HTTP 下载 | >= 7.54.0 |
| yaml-cpp | YAML 解析 | >= 0.6.3 |
| rapidjson | JSON 解析 | 系统安装 |
| toml11 | TOML 解析 | 系统安装 |
| PCRE2 | 正则表达式 | 系统安装 |
| QuickJS | JS 脚本引擎 | 系统安装 |
| libcron | 定时任务 | 系统安装 |
| cpp-httplib | HTTP 服务器（header-only） | 内置于 `include/` |
| inja | 模板引擎（header-only） | 内置于 `include/` |
| nlohmann/json | JSON（header-only） | 内置于 `include/` |
| jpcre2 | PCRE2 C++ 包装（header-only） | 内置于 `include/` |
