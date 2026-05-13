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

    const result: Record<string, unknown> = {
      name: g.name,
      type: g.type,
      proxies: [...new Set(members)], // Deduplicate
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
 * Build Clash rules from ruleset entries.
 * Each ruleset contributes lines like: "RULESET,group,rule" → "RULE-SET,..." or direct "DOMAIN-SUFFIX,..."
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
        // Inline rules: GEOIP,CN → GEOIP,CN,group
        // FINAL → MATCH,group
        if (trimmed.toUpperCase() === 'FINAL' || trimmed.toUpperCase() === 'MATCH') {
          rules.push(`MATCH,${entry.group}`)
        }
        else {
          rules.push(`${trimmed},${entry.group}`)
        }
      }
      else {
        // Standard rule lines already contain the rule type
        rules.push(`${trimmed},${entry.group}`)
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
