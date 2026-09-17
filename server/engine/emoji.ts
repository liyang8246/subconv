// @env node
import type { ClashProxy } from './types'

interface EmojiRule {
  pattern: RegExp
  emoji: string
}

const EMOJI_RULES: EmojiRule[] = [
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

/**
 * Prefix every proxy name with a region flag.
 * Intentionally always on and not exposed as an API option.
 */
export function applyEmoji(proxies: ClashProxy[]): ClashProxy[] {
  return proxies.map((p) => {
    let name = p.name
    // Strip existing emoji / old-style [XX] flags so we don't double-add
    name = name.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}]+/u, '').trim()
    name = name.replace(/^\[([A-Z]{2}|[^\]]+)\]\s*/g, '')

    for (const rule of EMOJI_RULES) {
      if (rule.pattern.test(name)) {
        return { ...p, name: `${rule.emoji} ${name}` }
      }
    }

    return { ...p, name: `🏳️ ${name}` }
  })
}
