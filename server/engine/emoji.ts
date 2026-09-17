// @env node
import type { ClashProxy } from './types'

interface EmojiRule {
  pattern: RegExp
  emoji: string
}

/**
 * Region flag rules. Order matters — the first match wins.
 *
 * Two things to keep in mind when editing:
 *  - Short ISO codes MUST use \b, otherwise "AUS-01" / "Jakarta" / "Russia" misfire.
 *  - Prefix-conflicting regions must come first:
 *    澳门 before 澳大利亚, 印度尼西亚 before 印度, 德国(法兰克福) before 法国.
 */
const EMOJI_RULES: EmojiRule[] = [
  { pattern: /(澳门|澳門|Macao|Macau|\bMO\b)/i, emoji: '🇲🇴' },
  { pattern: /(印尼|印度尼西亚|雅加达|Indonesia|Jakarta|\bID\b)/i, emoji: '🇮🇩' },
  { pattern: /(德|德国|法兰克福|Germany|Frankfurt|\bDE\b)/i, emoji: '🇩🇪' },
  { pattern: /(港|香港|Hong\s*Kong|\bHK\b)/i, emoji: '🇭🇰' },
  { pattern: /(台|台湾|新北|彰化|Taiwan|\bTW\b)/i, emoji: '🇨🇳' },
  { pattern: /(日本|东京|大阪|埼玉|Japan|\bJP\b)/i, emoji: '🇯🇵' },
  { pattern: /(韩|韓|首尔|Korea|\bKR\b|\bKOR\b)/i, emoji: '🇰🇷' },
  { pattern: /(新加坡|坡|狮城|Singapore|\bSG\b)/i, emoji: '🇸🇬' },
  { pattern: /(马来西亚|马来|Malaysia|吉隆坡|Kuala|\bMY\b)/i, emoji: '🇲🇾' },
  { pattern: /(泰国|泰國|曼谷|Thailand|Bangkok|\bTH\b)/i, emoji: '🇹🇭' },
  { pattern: /(越南|Vietnam|\bVN\b)/i, emoji: '🇻🇳' },
  { pattern: /(菲律宾|菲律賓|马尼拉|Philippines|Manila|\bPH\b)/i, emoji: '🇵🇭' },
  { pattern: /(印度|孟买|India|Mumbai|\bIN\b)/i, emoji: '🇮🇳' },
  { pattern: /(阿联酋|迪拜|Dubai|Emirates|\bAE\b|\bUAE\b)/i, emoji: '🇦🇪' },
  { pattern: /(土耳其|伊斯坦布尔|Turkey|Istanbul|\bTR\b)/i, emoji: '🇹🇷' },
  { pattern: /(以色列|Israel|\bIL\b)/i, emoji: '🇮🇱' },
  { pattern: /(英|英国|伦敦|United\s*Kingdom|Britain|London|England|\bUK\b|\bGB\b)/i, emoji: '🇬🇧' },
  { pattern: /(法|法国|巴黎|France|Paris|\bFR\b)/i, emoji: '🇫🇷' },
  { pattern: /(荷|荷兰|阿姆斯特丹|Netherlands|Amsterdam|\bNL\b)/i, emoji: '🇳🇱' },
  { pattern: /(俄|俄罗斯|莫斯科|Russia|Moscow|\bRU\b)/i, emoji: '🇷🇺' },
  { pattern: /(意大利|米兰|Italy|Milan|\bIT\b)/i, emoji: '🇮🇹' },
  { pattern: /(西班牙|马德里|Spain|Madrid|\bES\b)/i, emoji: '🇪🇸' },
  { pattern: /(瑞士|苏黎世|Switzerland|Zurich|\bCH\b)/i, emoji: '🇨🇭' },
  { pattern: /(瑞典|斯德哥尔摩|Sweden|Stockholm|\bSE\b)/i, emoji: '🇸🇪' },
  { pattern: /(挪威|奥斯陆|Norway|Oslo|\bNO\b)/i, emoji: '🇳🇴' },
  { pattern: /(芬兰|赫尔辛基|Finland|Helsinki|\bFI\b)/i, emoji: '🇫🇮' },
  { pattern: /(丹麦|哥本哈根|Denmark|Copenhagen|\bDK\b)/i, emoji: '🇩🇰' },
  { pattern: /(波兰|华沙|Poland|Warsaw|\bPL\b)/i, emoji: '🇵🇱' },
  { pattern: /(乌克兰|Ukraine|\bUA\b)/i, emoji: '🇺🇦' },
  { pattern: /(奥地利|维也纳|Austria|Vienna|\bAT\b)/i, emoji: '🇦🇹' },
  { pattern: /(爱尔兰|都柏林|Ireland|Dublin|\bIE\b)/i, emoji: '🇮🇪' },
  { pattern: /(比利时|布鲁塞尔|Belgium|Brussels|\bBE\b)/i, emoji: '🇧🇪' },
  { pattern: /(葡萄牙|里斯本|Portugal|Lisbon|\bPT\b)/i, emoji: '🇵🇹' },
  { pattern: /(捷克|布拉格|Czech|Prague|\bCZ\b)/i, emoji: '🇨🇿' },
  { pattern: /(美|美国|波特兰|达拉斯|俄勒冈|凤凰城|费利蒙|硅谷|拉斯维加斯|洛杉矶|圣何塞|圣克拉拉|西雅图|芝加哥|United\s*States|\bUS\b)/i, emoji: '🇺🇲' },
  { pattern: /(加拿大|多伦多|温哥华|Canada|Toronto|Vancouver|\bCA\b)/i, emoji: '🇨🇦' },
  { pattern: /(墨西哥|Mexico|\bMX\b)/i, emoji: '🇲🇽' },
  { pattern: /(澳|澳大利亚|澳洲|悉尼|Australia|Sydney|\bAU\b|\bAUS\b)/i, emoji: '🇦🇺' },
  { pattern: /(新西兰|New\s*Zealand|\bNZ\b)/i, emoji: '🇳🇿' },
  { pattern: /(巴西|圣保罗|Brazil|Sao\s*Paulo|\bBR\b)/i, emoji: '🇧🇷' },
  { pattern: /(阿根廷|Argentina|\bAR\b)/i, emoji: '🇦🇷' },
  { pattern: /(南非|South\s*Africa|\bZA\b)/i, emoji: '🇿🇦' },
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
