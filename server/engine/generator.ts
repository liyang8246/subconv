// @env node
import { stringify } from 'yaml'
import type { ClashProxy, ProxyGroup, RulesetEntry, GroupRef } from './types'
import { getPresetByName } from '../codegen'

function groupRefToMember(ref: GroupRef): string {
  switch (ref.kind) {
    case 'group': return ref.name
    case 'pattern': return ref.pattern
    case 'direct': return 'DIRECT'
    case 'reject': return 'REJECT'
    default: return 'DIRECT'
  }
}

function buildProxyGroups(proxies: ClashProxy[], groups: ProxyGroup[]): object[] {
  const proxyNames = new Set(proxies.map(p => p.name))

  return groups.map((g) => {
    const members = g.refs
      .map((ref) => {
        if (ref.kind === 'pattern' && ref.pattern === '.*') {
          return proxyNames.size > 0 ? [...proxyNames] : ['DIRECT']
        }
        if (ref.kind === 'pattern') {
          try {
            const re = new RegExp(ref.pattern)
            const matched = proxies.filter(p => re.test(p.name)).map(p => p.name)
            return matched.length > 0 ? matched : []
          }
          catch { return [] }
        }
        return groupRefToMember(ref)
      })
      .flat()
      .filter(Boolean)

    const uniqueMembers = [...new Set(members)]
    // Fallback to DIRECT when no proxies match — avoids Clash rejecting the config
    const proxiesList = uniqueMembers.length > 0 ? uniqueMembers : ['DIRECT']

    const result: Record<string, unknown> = {
      name: g.name,
      type: g.type,
      proxies: proxiesList,
    }

    if (g.url && g.type !== 'select') {
      result.url = g.url
      result.interval = g.interval ?? 300
      if (g.tolerance !== undefined) result.tolerance = g.tolerance
      if (g.timeout !== undefined) result.timeout = g.timeout
    }

    return result
  })
}

const CLASH_RULE_TYPES = [
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD',
  'IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR',
  'GEOIP', 'MATCH', 'FINAL',
  'SRC-PORT', 'DST-PORT', 'PROCESS-NAME',
]

function isClashRuleType(line: string): boolean {
  const upper = line.trim().toUpperCase()
  return CLASH_RULE_TYPES.some(t => upper.startsWith(t))
}

/**
 * Build Clash rules from ruleset entries.
 * Inserts the proxy-group before trailing flags (no-resolve, src, dst)
 * so Clash parsers the line correctly.
 */
function buildRules(rulesets: RulesetEntry[]): string[] {
  const rules: string[] = []

  for (const entry of rulesets) {
    for (const line of entry.rules) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (entry.inline) {
        const isFinal = trimmed.toUpperCase() === 'FINAL' || trimmed.toUpperCase() === 'MATCH'
        rules.push(isFinal ? `MATCH,${entry.group}` : `${trimmed},${entry.group}`)
      }
      else {
        if (!isClashRuleType(trimmed)) continue

        const parts = trimmed.split(',')
        const last = parts[parts.length - 1].trim().toLowerCase()
        const flags = new Set(['no-resolve', 'src', 'dst'])
        if (parts.length >= 3 && flags.has(last)) {
          parts.splice(parts.length - 1, 0, entry.group)
          rules.push(parts.join(','))
        }
        else {
          rules.push(`${trimmed},${entry.group}`)
        }
      }
    }
  }

  return rules
}

export function generateClashConfig(
  proxies: ClashProxy[],
  options: { preset?: string, port?: number, socksPort?: number, mode?: string },
): string {
  const port = options.port ?? 7890
  const socksPort = options.socksPort ?? 7891
  const mode = options.mode ?? 'rule'

  let rulesets: RulesetEntry[] = []
  let groups: ProxyGroup[] = []

  if (options.preset) {
    const preset = getPresetByName(options.preset)
    if (preset) {
      rulesets = preset.rulesets
      groups = preset.groups
    }
  }

  const proxyGroups = buildProxyGroups(proxies, groups)
  const rules = buildRules(rulesets)

  const config: Record<string, unknown> = {
    port,
    'socks-port': socksPort,
    mode,
    'allow-lan': false,
    'log-level': 'info',
    'external-controller': '0.0.0.0:9090',
    'secret': '',
    'dns': {
      'enable': true,
      'listen': '0.0.0.0:1053',
      'enhanced-mode': 'fake-ip',
      'fake-ip-range': '198.18.0.1/16',
      'nameserver': ['114.114.114.114', '223.5.5.5'],
      'fallback': ['8.8.8.8', '1.1.1.1'],
      'fallback-filter': { 'geoip': true, 'geoip-code': 'CN' },
    },
    proxies,
    'proxy-groups': proxyGroups,
    rules,
  }

  if (rules.length === 0) delete config.rules

  return stringify(config, { indent: 2, lineWidth: 0, sortMapEntries: false })
}
