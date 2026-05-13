// @env node
import type { ClashProxy, ConvertOptions } from './types'
import { DEFAULT_EMOJI_RULES } from './constants'

function applyFilters(
  proxies: ClashProxy[],
  options: Pick<ConvertOptions, 'exclude' | 'include'>,
): ClashProxy[] {
  let result = proxies

  if (options.exclude) {
    try {
      const re = new RegExp(options.exclude, 'i')
      result = result.filter(p => !re.test(p.name))
    }
    catch { /* invalid regex, skip */ }
  }

  if (options.include) {
    try {
      const re = new RegExp(options.include, 'i')
      result = result.filter(p => re.test(p.name))
    }
    catch { /* invalid regex, skip */ }
  }

  return result
}

function applyRename(proxies: ClashProxy[], renames: [string, string][]): ClashProxy[] {
  if (!renames || renames.length === 0) return proxies

  return proxies.map((p) => {
    let name = p.name
    for (const [pattern, replacement] of renames) {
      try { name = name.replace(new RegExp(pattern, 'gi'), replacement) }
      catch { /* invalid pattern, skip */ }
    }
    return name !== p.name ? { ...p, name } : p
  })
}

function applyEmoji(proxies: ClashProxy[]): ClashProxy[] {
  return proxies.map((p) => {
    let name = p.name
    // Strip existing emoji / old-style flags so we don't double-add
    name = name.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B50}]+/u, '').trim()
    name = name.replace(/^\[([A-Z]{2}|[^\]]+)\]\s*/g, '')

    for (const rule of DEFAULT_EMOJI_RULES) {
      if (rule.pattern.test(name)) {
        name = `${rule.emoji} ${name}`
        return { ...p, name }
      }
    }

    return { ...p, name: `🏳️ ${name}` }
  })
}

function applySort(proxies: ClashProxy[]): ClashProxy[] {
  return [...proxies].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

function applyNodeOverrides(
  proxies: ClashProxy[],
  options: Pick<ConvertOptions, 'udp' | 'tfo' | 'scv'>,
): ClashProxy[] {
  return proxies.map((p) => {
    const result = { ...p }
    if (options.udp !== undefined) result.udp = options.udp
    if (options.tfo !== undefined) result.tfo = options.tfo
    if (options.scv !== undefined) result['skip-cert-verify'] = options.scv
    return result
  })
}

/** Pipeline: filters → renames → sorts → emoji → attribute overrides */
export function processProxies(proxies: ClashProxy[], options: ConvertOptions): ClashProxy[] {
  let result = [...proxies]

  result = applyFilters(result, options)

  if (options.rename && options.rename.length > 0) {
    result = applyRename(result, options.rename)
  }

  result = applySort(result)

  if (options.emoji !== false) {
    result = applyEmoji(result)
  }

  result = applyNodeOverrides(result, options)

  return result
}
