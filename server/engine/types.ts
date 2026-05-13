/** A Clash proxy node — fields pass through as-is for unknown protocol keys */
export interface ClashProxy {
  name: string
  type: string
  server: string
  port: number
  [key: string]: unknown
}

export interface ClashSubscription {
  proxies: ClashProxy[]
  'proxy-groups'?: unknown[]
  rules?: unknown[]
  [key: string]: unknown
}

export type RuleLine = string

export interface RulesetEntry {
  group: string
  rules: RuleLine[]
  inline: boolean
}

export type GroupType = 'select' | 'url-test' | 'fallback' | 'load-balance'

export type GroupRef =
  | { kind: 'group', name: string }
  | { kind: 'pattern', pattern: string }
  | { kind: 'direct' }
  | { kind: 'reject' }

export interface ProxyGroup {
  name: string
  type: GroupType
  refs: GroupRef[]
  url?: string
  interval?: number
  tolerance?: number
  timeout?: number
}

export interface Preset {
  name: string
  description: string
  rulesets: RulesetEntry[]
  groups: ProxyGroup[]
}

export interface ConvertOptions {
  target: 'clash'
  url: string
  preset: string
  emoji?: boolean
  exclude?: string
  include?: string
  rename?: [string, string][]
  udp?: boolean
  tfo?: boolean
  scv?: boolean
}

export interface ConvertResult {
  config: string
  proxyCount: number
  ruleCount: number
  filename?: string
}

export interface EmojiRule {
  pattern: RegExp
  emoji: string
}
