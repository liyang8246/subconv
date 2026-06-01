// @env node
import { stringify } from 'yaml'
import type { ClashProxy, ProxyGroup, RulesetEntry, GroupRef } from './types'
import { getPresetByName } from '../codegen'

const BASE_CLASH_CONFIG = {
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
}

function groupRefToMember(ref: GroupRef): string {
  switch (ref.kind) {
    case 'group': return ref.name
    case 'pattern': return ref.pattern
    case 'direct': return 'DIRECT'
    case 'reject': return 'REJECT'
  }
}

function buildProxyGroups(proxies: ClashProxy[], groups: ProxyGroup[]): object[] {
  const proxyNames = new Set(proxies.map(p => p.name))

  return groups.map((g) => {
    const members = g.refs
      .flatMap((ref) => {
        if (ref.kind === 'pattern' && ref.pattern === '.*') {
          return proxyNames.size > 0 ? [...proxyNames] : ['DIRECT']
        }
        if (ref.kind === 'pattern') {
          try {
            const re = new RegExp(ref.pattern)
            return proxies.filter(p => re.test(p.name)).map(p => p.name)
          }
          catch { return [] }
        }
        return [groupRefToMember(ref)]
      })
      .filter(Boolean)

    const proxiesList = members.length > 0 ? [...new Set(members)] : ['DIRECT']

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

const RULE_FLAGS = new Set(['no-resolve', 'src', 'dst'])

function buildRules(rulesets: RulesetEntry[]): string[] {
  const rules: string[] = []

  for (const entry of rulesets) {
    for (const line of entry.rules) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (entry.inline) {
        const upper = trimmed.toUpperCase()
        rules.push(upper === 'FINAL' || upper === 'MATCH' ? `MATCH,${entry.group}` : `${trimmed},${entry.group}`)
      }
      else {
        if (!CLASH_RULE_TYPES.some(t => trimmed.toUpperCase().startsWith(t))) continue

        const parts = trimmed.split(',')
        const last = parts[parts.length - 1]!.trim().toLowerCase()
        if (parts.length >= 3 && RULE_FLAGS.has(last)) {
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

export function generateClashConfig(proxies: ClashProxy[], preset?: string): string {
  let rulesets: RulesetEntry[] = []
  let groups: ProxyGroup[] = []

  if (preset) {
    const p = getPresetByName(preset)
    if (p) {
      rulesets = p.rulesets
      groups = p.groups
    }
  }

  const sorted = [...proxies].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
  const proxyGroups = buildProxyGroups(sorted, groups)
  const rules = buildRules(rulesets)

  const config: Record<string, unknown> = {
    port: 7890,
    'socks-port': 7891,
    mode: 'rule',
    ...BASE_CLASH_CONFIG,
    proxies: sorted,
    'proxy-groups': proxyGroups,
    rules,
  }

  if (rules.length === 0) delete config.rules

  return stringify(config, { indent: 2, lineWidth: 0, sortMapEntries: false })
}
