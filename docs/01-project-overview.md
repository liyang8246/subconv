# ACL4SSR 项目总览

## 项目定位

ACL4SSR 是一套**代理规则集 + 订阅转换后端**的组合项目，核心目标是为各种代理工具（Clash、Surge、Quantumult X 等）提供开箱即用的规则配置与格式转换服务。

项目由两大部分组成：

| 组成部分 | 路径 | 语言 | 职责 |
|---------|------|------|------|
| **ACL4SSR 规则集** | `ACL4SSR/` 根目录 | 规则文本 | 提供去广告、直连、代理等规则碎片 |
| **subconverter 后端** | `ACL4SSR/subconverter/` | C++20 | 订阅格式转换 HTTP 服务 |

## 项目历史与生态

- **Telegram 频道**: https://t.me/ACL4SSR
- **原始作者**: ACL4SSR 规则集由社区维护，subconverter 由 [tindy2013](https://github.com/tindy2013/subconverter) 开发
- **常见前端**: [sub-web](https://github.com/CareyWang/sub-web)（Vue.js 写的前端界面）
- **许可证**: CC-BY-SA-4.0（规则集）、GPL（subconverter）

## 核心能力

### 1. 规则集（ACL4SSR）
- **SSR ACL 规则**（`.acl` 格式）：面向 SSR/SS 客户端的黑白名单
- **Clash 规则碎片**（`.list` 格式）：按域名/IP 分类的规则片段
- **Clash Provider**（`.yaml` 格式）：rule-provider 定义文件
- **subconverter 外部配置**（`.ini` 格式）：33 套预置配置方案

### 2. 订阅转换（subconverter）
- 支持 15 种以上的代理协议格式互转
- 自定义节点筛选、重命名、Emoji 标记
- 模板引擎驱动输出（inja 模板）
- 定时任务和 Gist 自动上传

## 项目文件结构

```
ACL4SSR/
├── Acl/                          # SSR 直接可用的 ACL 规则
│   ├── banAD.acl                 #   白名单 + 去广告（默认推荐）
│   ├── onlybanAD.acl             #   全局代理 + 去广告
│   ├── nobanAD.acl               #   白名单 + 无去广告
│   ├── backcn-banAD.acl          #   国内代理 + 去广告
│   ├── gfwlist-banAD.acl         #   黑名单 + 去广告
│   ├── fullgfwlist.acl           #   全量 GFW 列表
│   ├── easylist-banAD.acl        #   EasyList 去广告
│   ├── gfwlist-user.rule         #   SSR C# 自定义规则
│   └── china_ip_list.txt         #   国内 IP 段
│
├── Clash/                        # Clash 规则碎片 + subconverter 配置
│   ├── BanAD.list                #   广告拦截规则碎片
│   ├── BanProgramAD.list         #   应用广告拦截
│   ├── BanEasyList.list          #   EasyList 广告
│   ├── BanEasyListChina.list     #   中国区 EasyList
│   ├── BanEasyPrivacy.list       #   隐私追踪拦截
│   ├── ChinaDomain.list          #   国内域名直连
│   ├── ChinaCompanyIp.list       #   国内公司 IP 段
│   ├── ChinaIp.list / ChinaIpV6.list  # 国内 IP 段
│   ├── ChinaMedia.list           #   国内媒体
│   ├── ProxyGFWlist.list         #   GFW 全量代理列表
│   ├── ProxyLite.list            #   精简代理列表
│   ├── ProxyMedia.list           #   国外媒体代理
│   ├── Apple.list / Microsoft.list / OneDrive.list / ...
│   ├── Telegram.list / Netflix.list / ...
│   ├── GoogleCN.list             #   谷歌国内直连域名
│   ├── LocalAreaNetwork.list     #   局域网直连
│   ├── Download.list             #   下载域名直连
│   ├── GeneralClashConfig.yml    #   Clash 完整配置模板（935行注释丰富）
│   ├── pref.ini                  #   subconverter 默认配置（改端口为 8567）
│   ├── config/                   #   33 套 subconverter 外部配置方案
│   │   ├── ACL4SSR.ini
│   │   ├── ACL4SSR_Online.ini
│   │   ├── ACL4SSR_Online_Full.ini
│   │   ├── ACL4SSR_Online_Full_MultiMode.ini
│   │   ├── ACL4SSR_Online_Mini.ini
│   │   └── ...（共 33 个配置）
│   ├── Providers/                #   Clash proxy-provider/rule-provider 定义
│   │   ├── BanAD.yaml
│   │   ├── ChinaDomain.yaml
│   │   ├── ProxyGFWlist.yaml
│   │   └── ...（19 个 provider）
│   ├── Ruleset/                  #   细粒度分类规则（156 个文件）
│   │   ├── Netflix.list / YouTube.list / DisneyPlus.list / ...
│   │   ├── AI.list / OpenAi.list / Claude.list / Gemini.list
│   │   ├── Steam.list / Epic.list / Nintendo.list
│   │   ├── Tencent.list / Alibaba.list / ByteDance.list / ...
│   │   └── ...（按公司/平台/服务分类）
│   └── Providers/Ruleset/        #   Provider 格式的规则集
│
├── subconverter/                 # 订阅转换后端（C++ 项目）
│   ├── src/                      #   源代码
│   ├── base/                     #   基础配置和模板
│   ├── include/                  #   第三方头文件
│   └── scripts/                  #   构建脚本
│
├── Tool/                         # 辅助工具
│   ├── SwitchyOmega/             #   SwitchyOmega 配置
│   └── 正则语法.conf             #   正则参考
│
├── docs/                         # 项目分析文档（本目录）
├── README.md                     # 项目说明
└── LICENCE                       # 许可证
```

## 数据流简图

```
用户设备
  │
  ├──→ SSR/SS 客户端 ──→ 直接使用 .acl 规则
  │
  └──→ Clash/Surge 等 ──→ 订阅链接
                               │
                               ▼
                     subconverter HTTP 服务
                     (http://host:25500/sub)
                               │
                     ┌─────────┼─────────┐
                     ▼         ▼         ▼
              规则集加载   订阅获取   模板渲染
              (ACL4SSR)   (机场 URL)  (inja)
                     │         │         │
                     └─────────┼─────────┘
                               ▼
                        生成目标格式配置
                        返回给客户端
```

## 典型使用场景

1. **SSR 安卓用户**: 直接在 SSR app 中填入 `banAD.acl` 等 `.acl` 规则的 raw URL
2. **Clash 用户**: 使用 subconverter 将机场订阅转为 Clash 格式，并加载 ACL4SSR 的规则集
3. **高级用户**: 自建 subconverter 服务，定制外部配置（`config/*.ini`），实现个性化策略分组
