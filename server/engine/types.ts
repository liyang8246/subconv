// ============================================================
// Core type definitions for the subconverter engine
// ============================================================

/** A Clash proxy node (any protocol type, fields passed through) */
export interface ClashProxy {
  name: string
  type: string
  server: string
  port: number
  [key: string]: unknown
}

/** A parsed Clash subscription */
export interface ClashSubscription {
  proxies: ClashProxy[]
  /** Original proxy-groups (discarded) */
  'proxy-groups'?: unknown[]
  /** Original rules (discarded) */
  rules?: unknown[]
  [key: string]: unknown
}

/** A single rule line (e.g., "DOMAIN-SUFFIX,google.com") */
export type RuleLine = string

/** A ruleset entry referencing a named rule file or inline rule */
export interface RulesetEntry {
  /** The proxy-group name this ruleset belongs to */
  group: string
  /** The compiled-in rule lines, or inline rule like 'GEOIP,CN' */
  rules: RuleLine[]
  /** Is this an inline rule (GEOIP, MATCH, FINAL etc.) */
  inline: boolean
}

/** Proxy group types supported by Clash */
export type GroupType = 'select' | 'url-test' | 'fallback' | 'load-balance'

/** A reference to another group, node pattern, or built-in */
export type GroupRef =
  | { kind: 'group'; name: string }
  | { kind: 'pattern'; pattern: string }
  | { kind: 'direct' }
  | { kind: 'reject' }

/** A parsed proxy group definition */
export interface ProxyGroup {
  name: string
  type: GroupType
  refs: GroupRef[]
  /** URL for url-test/fallback/load-balance */
  url?: string
  /** Test interval in seconds */
  interval?: number
  /** Tolerance for url-test switching (ms) */
  tolerance?: number
  /** Timeout (ms) */
  timeout?: number
}

/** A preset configuration (parsed from .ini files) */
export interface Preset {
  name: string
  description: string
  /** Ruleset entries in order */
  rulesets: RulesetEntry[]
  /** Proxy group definitions */
  groups: ProxyGroup[]
}

/** Options for the subscription conversion pipeline */
export interface ConvertOptions {
  /** Target format (always 'clash' in this project) */
  target: 'clash'
  /** Subscription URL(s), | delimited */
  url: string
  /** Preset name to apply */
  preset: string
  /** Whether to add emoji prefixes to node names */
  emoji?: boolean
  /** Regex to exclude nodes matching this pattern */
  exclude?: string
  /** Regex to include only nodes matching this pattern */
  include?: string
  /** Rename rules: array of [pattern, replacement] */
  rename?: [string, string][]
  /** Enable UDP for all nodes */
  udp?: boolean
  /** Enable TCP Fast Open for all nodes */
  tfo?: boolean
  /** Skip certificate verification */
  scv?: boolean
}

/** The result of a conversion */
export interface ConvertResult {
  /** The generated Clash YAML config */
  config: string
  /** Number of proxies found */
  proxyCount: number
  /** Number of rules applied */
  ruleCount: number
}

/** Emoji mapping rule */
export interface EmojiRule {
  pattern: RegExp
  emoji: string
}

/** Default emoji rules from ACL4SSR conventions */
export const DEFAULT_EMOJI_RULES: EmojiRule[] = [
  { pattern: /(港|HK|Hong\s*Kong|HongKong|hongkong)/i, emoji: '🇭🇰' },
  { pattern: /(台|TW|Taiwan|台湾)/i, emoji: '🇨🇳' },
  { pattern: /(日|JP|Japan|日本)/i, emoji: '🇯🇵' },
  { pattern: /(美|US|United\s*States|美国)/i, emoji: '🇺🇲' },
  { pattern: /(新加坡|坡|狮城|SG|Singapore)/i, emoji: '🇸🇬' },
  { pattern: /(韩|KR|Korea|KOR|首尔|韓)/i, emoji: '🇰🇷' },
  { pattern: /(英|UK|United\s*Kingdom|英国|伦敦)/i, emoji: '🇬🇧' },
  { pattern: /(德|DE|Germany|德国)/i, emoji: '🇩🇪' },
  { pattern: /(澳|AU|Australia|澳洲|悉尼)/i, emoji: '🇦🇺' },
  { pattern: /(加拿大|CA|Canada|温哥华|多伦多)/i, emoji: '🇨🇦' },
  { pattern: /(俄|RU|Russia|俄罗斯)/i, emoji: '🇷🇺' },
  { pattern: /(印度|IN|India|孟买)/i, emoji: '🇮🇳' },
  { pattern: /(法国|FR|France)/i, emoji: '🇫🇷' },
  { pattern: /(荷兰|NL|Netherlands)/i, emoji: '🇳🇱' },
  { pattern: /(巴西|BR|Brazil)/i, emoji: '🇧🇷' },
  { pattern: /(泰国|TH|Thailand|曼谷)/i, emoji: '🇹🇭' },
  { pattern: /(越南|VN|Vietnam)/i, emoji: '🇻🇳' },
  { pattern: /(土耳其|TR|Turkey)/i, emoji: '🇹🇷' },
  { pattern: /(阿根廷|AR|Argentina)/i, emoji: '🇦🇷' },
  { pattern: /(菲律宾|PH|Philippines)/i, emoji: '🇵🇭' },
  { pattern: /(印尼|ID|Indonesia)/i, emoji: '🇮🇩' },
  { pattern: /(马来西亚|MY|Malaysia)/i, emoji: '🇲🇾' },
]
