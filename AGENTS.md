# AGENTS.md

Clash 订阅转换器: Nuxt 4 + Nitro serverless app. The browser assembles a `/api/sub` URL; the API fetches upstream subscriptions, rewrites proxies/groups/rules from compiled ACL4SSR presets, and returns Clash YAML.

## Setup (order matters)
- ACL4SSR is a git submodule and no rule code is committed. Run `git submodule update --init --recursive` **before** `pnpm install`.
- `postinstall` = `run-s codegen prepare`. Codegen throws (ENOENT on `ACL4SSR/Clash/config`) if the submodule is missing, so install fails without it.
- Scripts: `pnpm dev`, `pnpm build`, `pnpm generate`, `pnpm preview`, `pnpm codegen`. There are no test / lint / typecheck scripts — `pnpm build` is the only full verification.

## Generated code — do not edit by hand
- `server/codegen/` is gitignored and produced by `pnpm codegen` (`scripts/codegen.ts`).
- It compiles `ACL4SSR/Clash/*.list` + `Clash/Ruleset/*.list` → `rules.ts` / `ruleset.ts`, and `ACL4SSR/Clash/config/*.ini` → `presets.ts` (`Preset` objects) + `index.ts`.
- The engine imports from `../codegen`; TS errors on an unresolved `../codegen` until codegen runs. Re-run `pnpm codegen` after updating the submodule or editing `scripts/codegen.ts`.

## Layout / entrypoints
- Frontend files sit at the repo root (no `app/` dir): `app.vue`, `pages/index.vue`, `composables/useSubConverter.ts`, `assets/main.css`.
- API handlers: `server/api/sub.get.ts`, `presets.get.ts`, `shorten.post.ts`.
- Pure conversion engine in `server/engine/`: `parser.ts` (fetch + detect YAML / Base64 / share links), `pipeline.ts` (proxy transforms), `generator.ts` (Clash YAML), `types.ts`, `constants.ts` (emoji rules).
- Runtime-file convention: server-only files start with `// @env node`, browser code with `// @env browser`.

## Behaviors easy to break
- `processProxies` order is fixed: filter (`exclude`/`include` regex) → rename → sort → emoji → `udp`/`tfo`/`scv` overrides. Emoji is on by default; only `emoji=false` disables it.
- `resolveInput` accepts `|`-separated upstreams, URL-decodes each, dedupes by `type:server:port:name`, and merges upstream `subscription-userinfo` (traffic summed, earliest `expire`).
- Generator appends the target group to each ruleset `.list` line and drops non-Clash rule types; proxy groups with no matching nodes fall back to `DIRECT` so Clash doesn't reject the config. Empty `rules` are deleted.
- Upstream fetch uses `User-Agent: Clash Verge/2.5.1` and a 15s timeout; failures return empty proxies instead of erroring (API then returns `# No proxies found`).
- `shorten.post.ts` hardcodes external shorteners (`v1.mk` / `d1.mk`).
- Deployment: Nitro preset is `vercel`; `vercel.json` runs submodule init then `pnpm install`.

## Notes
- `docs/01`–`07` analyze the original C++ subconverter (research/planning), not this codebase. `docs/08` is the plan but references stale paths (`rules/ACL4SSR`, `group-refs.ts`, Bun). Trust code and config over `docs/`.
- Commit messages use Conventional Commits with Chinese descriptions (e.g. `fix: ...`).
