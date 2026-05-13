// ============================================================
// Node processing pipeline: filter, rename, sort, emoji
// ============================================================

import type { ClashProxy, ConvertOptions } from './types'
import { DEFAULT_EMOJI_RULES } from './types'

/**
 * Apply exclude/include regex filters.
 */
function applyFilters(
  proxies: ClashProxy[],
  options: Pick<ConvertOptions, 'exclude' | 'include'>,
): ClashProxy[] {
  let result = proxies

  if (options.exclude) {
    try {
      const re = new RegExp(options.exclude, 'i')
      result = result.filter(p => !re.test(p.name))
    } catch {
      // Invalid regex, skip
    }
  }

  if (options.include) {
    try {
      const re = new RegExp(options.include, 'i')
      result = result.filter(p => re.test(p.name))
    } catch {
      // Invalid regex, skip
    }
  }

  return result
}

/**
 * Apply rename rules (subconverter-compatible).
 * Each rename rule is [pattern, replacement].
 */
function applyRename(
  proxies: ClashProxy[],
  renames: [string, string][],
): ClashProxy[] {
  if (!renames || renames.length === 0) return proxies

  return proxies.map(p => {
    let name = p.name
    for (const [pattern, replacement] of renames) {
      try {
        name = name.replace(new RegExp(pattern, 'gi'), replacement)
      } catch {
        // Invalid pattern, skip
      }
    }
    return name !== p.name ? { ...p, name } : p
  })
}

/**
 * Apply emoji prefixes based on region matching rules.
 */
function applyEmoji(proxies: ClashProxy[]): ClashProxy[] {
  return proxies.map(p => {
    let name = p.name
    // Remove existing emoji at the start
    name = name.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]+/u, '').trim()
    // Remove old-style flags like [HK], [JP], etc.
    name = name.replace(/^\[([A-Z]{2}|[^\]]+)\]\s*/g, '')

    // Find matching emoji
    let matched = false
    for (const rule of DEFAULT_EMOJI_RULES) {
      if (rule.pattern.test(name)) {
        name = `${rule.emoji} ${name}`
        matched = true
        break
      }
    }

    // Default: no emoji for unmatched
    if (!matched) {
      name = `🏳️ ${name}`
    }

    return { ...p, name }
  })
}

/**
 * Sort proxies alphabetically by name.
 */
function applySort(proxies: ClashProxy[]): ClashProxy[] {
  return [...proxies].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

/**
 * Apply node-level property overrides (udp, tfo, scv).
 */
function applyNodeOverrides(
  proxies: ClashProxy[],
  options: Pick<ConvertOptions, 'udp' | 'tfo' | 'scv'>,
): ClashProxy[] {
  return proxies.map(p => {
    const result = { ...p }
    if (options.udp !== undefined) result.udp = options.udp
    if (options.tfo !== undefined) result.tfo = options.tfo
    if (options.scv !== undefined) {
      result['skip-cert-verify'] = options.scv
    }
    return result
  })
}

/**
 * Full node processing pipeline.
 * Filters → Renames → Sorts → Adds Emoji → Overrides node attributes.
 */
export function processProxies(
  proxies: ClashProxy[],
  options: ConvertOptions,
): ClashProxy[] {
  let result = [...proxies]

  // 1. Filter (exclude / include)
  result = applyFilters(result, options)

  // 2. Rename
  if (options.rename && options.rename.length > 0) {
    result = applyRename(result, options.rename)
  }

  // 3. Sort
  result = applySort(result)

  // 4. Add Emoji
  if (options.emoji !== false) {
    result = applyEmoji(result)
  }

  // 5. Node attribute overrides
  result = applyNodeOverrides(result, options)

  return result
}
