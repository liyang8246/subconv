// ============================================================
// Clash configuration generator
// Builds complete Clash YAML from proxies + compiled rules/presets
// ============================================================

import { stringify } from 'yaml'
import type { ClashProxy, ProxyGroup, RulesetEntry, GroupRef } from './types'
import { getPresetByName } from '../codegen'

/**
 * Convert a GroupRef to a Clash proxy-group member name.
 * Handles: group reference, pattern, DIRECT, REJECT.
 */
function groupRefToMember(ref: GroupRef, _groups: ProxyGroup[]): string {
  switch (ref.kind) {
    case 'group':
      return ref.name
    case 'pattern':
      return ref.pattern
    case 'direct':
      return 'DIRECT'
    case 'reject':
      return 'REJECT'
    default:
      return 'DIRECT'
  }
}

/**
 * Build Clash proxy-groups from preset definitions.
 * Filters groups that reference only valid proxies.
 */
function buildProxyGroups(
  proxies: ClashProxy[],
  groups: ProxyGroup[],
): object[] {
  const proxyNames = new Set(proxies.map(p => p.name))

  return groups.map((g) => {
    const members = g.refs
      .map((ref) => {
        if (ref.kind === 'pattern' && ref.pattern === '.*') {
          // All proxies
          return proxyNames.size > 0 ? [...proxyNames] : ['DIRECT']
        }
        if (ref.kind === 'pattern') {
          // Filter proxies matching the regex
          try {
            const re = new RegExp(ref.pattern)
            const matched = proxies
              .filter(p => re.test(p.name))
              .map(p => p.name)
            return matched.length > 0 ? matched : []
          }
          catch {
            return []
          }
        }
        return groupRefToMember(ref, groups)
      })
      .flat()
      .filter(Boolean)

    // Deduplicate
    const uniqueMembers = [...new Set(members)]

    // If no proxies matched the group's pattern, fallback to DIRECT
    // to avoid Clash rejecting the config with "use or proxies missing"
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

/**
 * Rule types supported by Clash (and Clash Meta / Verge).
 * Lines starting with other types (e.g., URL-REGEX, USER-AGENT, AND, OR, NOT)
 * are Surge-specific and should be skipped.
 */
const CLASH_RULE_TYPES = [
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD',
  'IP-CIDR', 'IP-CIDR6', 'SRC-IP-CIDR',
  'GEOIP', 'MATCH', 'FINAL',
  'SRC-PORT', 'DST-PORT', 'PROCESS-NAME',
]

function isClashRuleType(line: string): boolean {
  const upper = line.trim().toUpperCase()
  return CLASH_RULE_TYPES.some(t => upper.startsWith(t.toUpperCase()))
}

/**
 * Build Clash rules from ruleset entries.
 * Formats: "TYPE,MATCHER" or "TYPE,MATCHER,no-resolve" etc.
 * We insert the group before flags like "no-resolve" so Clash parses correctly.
 */
function buildRules(
  rulesets: RulesetEntry[],
): string[] {
  const rules: string[] = []

  for (const entry of rulesets) {
    for (const line of entry.rules) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      if (entry.inline) {
        if (trimmed.toUpperCase() === 'FINAL' || trimmed.toUpperCase() === 'MATCH') {
          rules.push(`MATCH,${entry.group}`)
        }
        else {
          rules.push(`${trimmed},${entry.group}`)
        }
      }
      else {
        // Skip rule types not supported by Clash (e.g. URL-REGEX, USER-AGENT from Surge)
        if (!isClashRuleType(trimmed)) continue

        // Standard rule: may have trailing flags like no-resolve
        // Insert group before the last field if it's a flag keyword
        const parts = trimmed.split(',')
        const last = parts[parts.length - 1].trim().toLowerCase()
        const flags = ['no-resolve', 'src', 'dst']
        if (parts.length >= 3 && flags.includes(last)) {
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

/**
 * Generate a complete Clash YAML configuration.
 */
export function generateClashConfig(
  proxies: ClashProxy[],
  options: { preset?: string, port?: number, socksPort?: number, mode?: string },
): string {
  const port = options.port ?? 7890
  const socksPort = options.socksPort ?? 7891
  const mode = options.mode ?? 'rule'

  // Load preset if specified
  let rulesets: RulesetEntry[] = []
  let groups: ProxyGroup[] = []

  if (options.preset) {
    const preset = getPresetByName(options.preset)
    if (preset) {
      rulesets = preset.rulesets
      groups = preset.groups
    }
  }

  // Build proxy-groups
  const proxyGroups = buildProxyGroups(proxies, groups)

  // Build rules
  const rules = buildRules(rulesets)

  // Build the config object
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
      'fallback-filter': {
        'geoip': true,
        'geoip-code': 'CN',
      },
    },
    proxies,
    'proxy-groups': proxyGroups,
    rules,
  }

  // Remove rules if empty
  if (rules.length === 0) {
    delete config.rules
  }

  return stringify(config, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  })
}

/**
 * Generate a combined "rule-provider style" YAML with proxie-providers.
 * Useful for Clash Premium/Meta deployments.
 */
export function generateClashMetaConfig(
  proxies: ClashProxy[],
  subscriptionUrl: string,
  options: { preset?: string, port?: number },
): string {
  // Similar to generateClashConfig but with proxy-provider references
  const config = generateClashConfig(proxies, options)

  // Convert proxies to proxy-provider
  const withProvider = config
    .replace(/proxies:/, 'proxy-providers:\n  sub:\n    type: http\n    url: "placeholder"\n    interval: 3600\n    path: ./sub.yaml\n    health-check:\n      enable: true\n      url: http://www.gstatic.com/generate_204\n      interval: 300\n\nproxies:')

  return withProvider
}
