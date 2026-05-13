# subconv

Clash 订阅转换器 — 多上游聚合、规则预设、纯前端 URL 拼装。

## 使用方式

### 在线版
部署后直接访问，粘贴订阅链接即可生成转换后的 Clash 配置链接。

### GET API
```
GET /api/sub?url=<订阅链接>&preset=<预设名>
```
可选参数：`emoji` `exclude` `include` `rename` `udp` `tfo` `scv` `port` `socksPort` `mode` `filename`

### 本地开发
```bash
pnpm install
pnpm run dev
```

## 技术栈

Nuxt 4 · Nitro · Vue 3 · TypeScript · Tailwind CSS · DaisyUI

Serverless 部署，无状态设计。Vercel 一键部署。
