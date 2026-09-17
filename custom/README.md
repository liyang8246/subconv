# custom/ — 本仓库自定义规则与预设

这里放**本项目自己维护**的 ACL4SSR 规则和预设，不依赖、也不修改 `ACL4SSR` 子模块。
`ACL4SSR` 是 submodule（主仓只记录 commit 指针），直接改它里面的文件不会被提交、`git submodule update` 还会覆盖；要长期生效的改动请放在这里。

## 目录结构（与 `ACL4SSR/Clash/` 同构）

```
custom/Clash/
├── *.list                 # 顶层规则 → server/codegen/rules.ts
├── Ruleset/*.list         # 细分类规则 → server/codegen/ruleset.ts
└── config/*.ini           # 预设 → server/codegen/presets.ts（会出现在 UI 下拉里）
```

## 覆盖规则

codegen 先扫 `ACL4SSR/Clash/`，再扫 `custom/Clash/`，**逻辑路径相同者后者覆盖前者**：

| custom 文件 | 覆盖的 ACL4SSR 文件 |
|---|---|
| `custom/Clash/AI.list` | `ACL4SSR/Clash/AI.list` |
| `custom/Clash/Ruleset/AI.list` | `ACL4SSR/Clash/Ruleset/AI.list` |
| `custom/Clash/config/ACL4SSR_Online_Mini.ini` | 同名预设 |

> 注意 key 是相对 `Clash/` 的路径：顶层文件 key 为 `AI`，`Ruleset/` 下为 `Ruleset/AI`。
> 想覆盖 ACL4SSR 的 `Clash/Ruleset/AI.list`，就必须放在 `custom/Clash/Ruleset/AI.list`。

## 写自定义预设（.ini）

格式与 ACL4SSR 一致。规则引用靠 URL 中的 `/Clash/xxx.list` 反查本地文件：

```ini
[custom]
; 引用本地自定义规则（URL 只是为了解析出路径，不会真的下载）
ruleset=💬 Ai平台,https://example.com/Clash/Ruleset/MyAI.list
; 或内联单条规则（`[]` 后面直接跟规则内容）
ruleset=🇺🇲 美国节点,[]DOMAIN-SUFFIX,openai.com

; 策略组：组名`类型`成员...  （成员可为 组名 / .* / DIRECT / REJECT / []组名 / 正则）
custom_proxy_group=🚀 节点选择`select`[]🇺🇲 美国节点`[]DIRECT
custom_proxy_group=🇺🇲 美国节点`url-test`(美|US|United States)`http://www.gstatic.com/generate_204`300,,50
```

- `select` / `url-test` / `fallback` / `load-balance` 四种类型都支持。
- 描述取 `[custom]` 段里的 `;` 注释（会显示在 UI 上）。

## 两个约束

1. **文件名决定代码归属**：顶层 `.list` 进 `rules.ts`，`Ruleset/*.list` 进 `ruleset.ts`，变量名前缀分别为 `Main*` / `Ruleset*`。按上面的目录放就自动满足。
2. **规则引用必须能映射到本地文件**，否则该 ruleset 会被静默丢弃。用 `https://.../Clash/Foo.list` 或 `https://.../Clash/Ruleset/Foo.list` 的形式即可。

## 生效方式

```bash
pnpm codegen      # 重新生成 server/codegen/
```

`server/codegen/` 是生成物且被 gitignore，**不要手动改**；改这里的源文件后重跑 codegen 即可。
