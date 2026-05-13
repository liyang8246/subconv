// ============================================================
// Subscription parser: detect format, decode, extract proxies
// Handles: Clash YAML, Base64 share links, multi-subscription merge
// ============================================================

import { parse as parseYaml } from 'yaml'
import type { ClashProxy, ClashSubscription } from './types'

// ──────────────────────────────────────────────
// Utility: Base64 detection and decoding
// ──────────────────────────────────────────────

function isShareLinkContent(text: string): boolean {
  return /^(ss|ssr|vmess|trojan|vless|hysteria2?|tuic):\/\//m.test(text.trim())
}

function isYaml(text: string): boolean {
  return /^(proxies:|Proxy:|port:|mixed-port:|socks-port:|allow-lan:|mode:)/m.test(text.trim())
}

function base64Decode(str: string): string {
  try {
    const clean = str.replace(/[\s\r\n\t]+/g, '')
    return Buffer.from(clean, 'base64').toString('utf-8')
  } catch {
    return str
  }
}

function looksLikeBase64(str: string): boolean {
  const trimmed = str.trim()
  if (trimmed.length === 0) return false
  // If it already looks like YAML or share links, skip
  if (isYaml(trimmed) || isShareLinkContent(trimmed)) return false
  return /^[A-Za-z0-9+/=\s\r\n]+$/.test(trimmed) && trimmed.length > 20
}

// ──────────────────────────────────────────────
// Share link parsers (ss:// ssr:// vmess:// etc.)
// ──────────────────────────────────────────────

function urlSafeBase64Decode(str: string): string {
  try {
    const base64 = str
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    // Pad if needed
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(padded, 'base64').toString('utf-8')
  } catch {
    return str
  }
}

/** Parse SS link: ss://base64(method:password)@server:port#name or ss://method:password@server:port#name */
function parseSS(uri: string): ClashProxy | null {
  try {
    const url = new URL(uri)
    const server = url.hostname
    const port = Number.parseInt(url.port) || 8388
    const name = decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)

    // SS original style: ss://base64(method:password)@server:port
    // SIP002 style: ss://method:password@server:port
    let userInfo = decodeURIComponent(url.username)
    if (!userInfo) return null

    // If userInfo is pure base64, decode it (original style)
    let method: string
    let password: string
    if (/^[A-Za-z0-9+/=]+$/.test(userInfo) && userInfo.length > 4) {
      const decoded = urlSafeBase64Decode(userInfo)
      const colon = decoded.indexOf(':')
      if (colon === -1) return null
      method = decoded.slice(0, colon)
      password = decoded.slice(colon + 1)
    } else {
      // SIP002: method:password in the user part
      const colon = userInfo.indexOf(':')
      if (colon === -1) return null
      method = userInfo.slice(0, colon)
      password = userInfo.slice(colon + 1)
    }

    const result: Record<string, unknown> = {
      name,
      type: 'ss',
      server,
      port,
      cipher: method,
      password,
    }

    // Plugin
    const plugin = url.searchParams.get('plugin')
    if (plugin) {
      const parts = plugin.split(';')
      const pluginName = parts[0]
      const pluginOpts = parts[1] || ''
      result.plugin = pluginName
      result['plugin-opts'] = {
        mode: new URLSearchParams(pluginOpts).get('mode') || 'websocket',
        host: new URLSearchParams(pluginOpts).get('host') || '',
        path: new URLSearchParams(pluginOpts).get('path') || '/',
        tls: new URLSearchParams(pluginOpts).get('tls') === 'true',
      }
    }

    return result as ClashProxy
  } catch {
    return null
  }
}

/** Parse VMess link: vmess://base64(json) */
function parseVMess(uri: string): ClashProxy | null {
  try {
    const body = uri.replace('vmess://', '')
    const jsonStr = urlSafeBase64Decode(body.trim())
    const cfg = JSON.parse(jsonStr)
    return {
      name: cfg.ps || cfg.remark || `${cfg.add}:${cfg.port}`,
      type: 'vmess',
      server: cfg.add || cfg.host || '',
      port: Number.parseInt(cfg.port) || 443,
      uuid: cfg.id || '',
      alterId: cfg.aid ?? 0,
      cipher: cfg.scy || cfg.security || 'auto',
      network: cfg.net || 'tcp',
      'ws-opts': cfg.net === 'ws' ? {
        path: cfg.path || '/',
        headers: { Host: cfg.host || cfg.sni || '' },
      } : undefined,
      tls: cfg.tls === 'tls',
      servername: cfg.sni || undefined,
    } as ClashProxy
  } catch {
    return null
  }
}

/** Parse SSR link: ssr://base64(...) */
function parseSSR(uri: string): ClashProxy | null {
  try {
    const body = uri.replace('ssr://', '')
    const decoded = urlSafeBase64Decode(body.trim())

    // SSR format: server:port:protocol:method:obfs:base64password/?params
    const mainAndParams = decoded.split('/?')
    const main = mainAndParams[0].split(':')

    if (main.length < 6) return null

    const server = main[0]
    const port = Number.parseInt(main[1]) || 443
    const protocol = main[2]
    const method = main[3]
    const obfs = main[4]
    const password = urlSafeBase64Decode(main[5])

    // Parse params
    const params = new URLSearchParams(mainAndParams[1] || '')
    const name = urlSafeBase64Decode(params.get('remarks') || '') || `${server}:${port}`
    const obfsParam = urlSafeBase64Decode(params.get('obfsparam') || '')
    const protocolParam = urlSafeBase64Decode(params.get('protoparam') || '')

    return {
      name,
      type: 'ssr',
      server,
      port,
      cipher: method,
      password,
      protocol,
      'protocol-param': protocolParam || undefined,
      obfs,
      'obfs-param': obfsParam || undefined,
    } as ClashProxy
  } catch {
    return null
  }
}

/** Parse Trojan link: trojan://password@server:port?peer=sni&allowInsecure=1#name */
function parseTrojan(uri: string): ClashProxy | null {
  try {
    const url = new URL(uri)
    const password = url.username || url.password
    const server = url.hostname
    const port = Number.parseInt(url.port) || 443
    const name = decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)
    const sni = url.searchParams.get('sni') || url.searchParams.get('peer') || server
    const skipCert = url.searchParams.get('allowInsecure') === '1' || url.searchParams.get('skip-cert-verify') === 'true'

    return {
      name,
      type: 'trojan',
      server,
      port,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      udp: url.searchParams.has('udp') ? url.searchParams.get('udp') === '1' : undefined,
    } as ClashProxy
  } catch {
    return null
  }
}

/** Parse VLESS link: vless://uuid@server:port?encryption=none&security=tls&type=ws&... */
function parseVLESS(uri: string): ClashProxy | null {
  try {
    const url = new URL(uri)
    const uuid = url.username
    const server = url.hostname
    const port = Number.parseInt(url.port) || 443
    const name = decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)

    const security = url.searchParams.get('security') || 'none'
    const encryption = url.searchParams.get('encryption') || 'none'
    const networkType = url.searchParams.get('type') || 'tcp'
    const sni = url.searchParams.get('sni') || server
    const flow = url.searchParams.get('flow') || undefined
    const realityKey = url.searchParams.get('pbk') || undefined
    const fingerprint = url.searchParams.get('fp') || undefined

    const result: Record<string, unknown> = {
      name,
      type: 'vless',
      server,
      port,
      uuid,
      encryption,
      network: networkType,
      sni,
      servername: sni,
      flow: flow || undefined,
      'reality-opts': realityKey ? {
        'public-key': realityKey,
        'short-id': url.searchParams.get('sid') || '',
      } : undefined,
      fingerprint,
    }

    if (security === 'tls' || security === 'reality') {
      result.tls = true
    }

    // WebSocket opts
    if (networkType === 'ws') {
      result['ws-opts'] = {
        path: url.searchParams.get('path') || '/',
        headers: {
          Host: url.searchParams.get('host') || sni,
        },
      }
    }

    // gRPC opts
    if (networkType === 'grpc') {
      result['grpc-opts'] = {
        'grpc-service-name': url.searchParams.get('serviceName') || '',
      }
    }

    return result as ClashProxy
  } catch {
    return null
  }
}

/** Parse Hysteria2 link: hysteria2://password@server:port?sni=...&insecure=1&... */
function parseHysteria2(uri: string): ClashProxy | null {
  try {
    const url = new URL(uri)
    const password = url.username
    const server = url.hostname
    const port = Number.parseInt(url.port) || 443
    const name = decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)
    const sni = url.searchParams.get('sni') || server
    const skipCert = url.searchParams.get('insecure') === '1'
    const obfs = url.searchParams.get('obfs') || undefined
    const obfsPassword = url.searchParams.get('obfs-password') || undefined
    const upMbps = url.searchParams.has('upmbps') ? Number(url.searchParams.get('upmbps')) : undefined
    const downMbps = url.searchParams.has('downmbps') ? Number(url.searchParams.get('downmbps')) : undefined

    return {
      name,
      type: 'hysteria2',
      server,
      port,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      obfs,
      'obfs-password': obfsPassword,
      up: upMbps,
      down: downMbps,
    } as ClashProxy
  } catch {
    return null
  }
}

/** Parse TUIC link: tuic://uuid:password@server:port?sni=...&... */
function parseTUIC(uri: string): ClashProxy | null {
  try {
    const url = new URL(uri)
    const uuid = url.username
    const password = url.password
    const server = url.hostname
    const port = Number.parseInt(url.port) || 443
    const name = decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)
    const sni = url.searchParams.get('sni') || server
    const skipCert = url.searchParams.get('allow_insecure') === '1'
    const alpn = url.searchParams.get('alpn') ? url.searchParams.get('alpn')!.split(',') : undefined
    const congestion = url.searchParams.get('congestion_control') || 'cubic'

    return {
      name,
      type: 'tuic',
      server,
      port,
      uuid,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      alpn,
      'congestion-controller': congestion,
    } as ClashProxy
  } catch {
    return null
  }
}

/** Parse a single share link line into a ClashProxy */
function parseShareLink(line: string): ClashProxy | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Skip non-proxy lines (metadata, info lines)
  if (/^(http|https):\/\//.test(trimmed) && !trimmed.includes('@')) return null
  if (/^(剩余|距离|套餐|到期|流量|到期时间|官网|产品|平台|请用|订阅|STATUS)/.test(trimmed)) return null

  if (trimmed.startsWith('ss://')) return parseSS(trimmed)
  if (trimmed.startsWith('ssr://')) return parseSSR(trimmed)
  if (trimmed.startsWith('vmess://')) return parseVMess(trimmed)
  if (trimmed.startsWith('trojan://')) return parseTrojan(trimmed)
  if (trimmed.startsWith('vless://')) return parseVLESS(trimmed)
  if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) return parseHysteria2(trimmed)
  if (trimmed.startsWith('hysteria://')) return parseHysteria2(trimmed) // Fallback
  if (trimmed.startsWith('tuic://')) return parseTUIC(trimmed)

  return null
}

/**
 * Parse a block of share links (one per line) into ClashProxy[].
 * Each line is a share link like ss://... or vmess://...
 */
export function parseShareLinks(content: string): ClashProxy[] {
  const lines = content.split('\n')
  const proxies: ClashProxy[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const proxy = parseShareLink(trimmed)
    if (proxy) {
      proxies.push(proxy)
    }
  }

  return proxies
}

// ──────────────────────────────────────────────
// YAML parsing
// ──────────────────────────────────────────────

export function extractProxies(doc: Record<string, unknown>): ClashProxy[] {
  const raw = (doc.proxies || doc.Proxy || []) as ClashProxy[]
  return raw.map(p => ({
    ...p,
    name: String(p.name ?? ''),
    type: String(p.type ?? ''),
    server: String(p.server ?? ''),
    port: Number(p.port ?? 0),
  }))
}

// ──────────────────────────────────────────────
// Main content parsing
// ──────────────────────────────────────────────

/**
 * Parse any subscription content.
 * Detects: YAML, Base64→YAML, Base64→share links, raw share links.
 */
export function parseContent(text: string): ClashProxy[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // If it's already YAML, parse as Clash config
  if (isYaml(trimmed)) {
    try {
      const doc = parseYaml(trimmed) as Record<string, unknown>
      if (doc && typeof doc === 'object') {
        const proxies = extractProxies(doc)
        if (proxies.length > 0) return proxies
      }
    } catch {
      // Not valid YAML, continue
    }
  }

  // If it looks like share links directly
  if (isShareLinkContent(trimmed)) {
    return parseShareLinks(trimmed)
  }

  // Try Base64 decode
  if (looksLikeBase64(trimmed)) {
    let decoded = base64Decode(trimmed).trim()

    // Check decoded content
    if (isShareLinkContent(decoded)) {
      return parseShareLinks(decoded)
    }

    if (isYaml(decoded)) {
      try {
        const doc = parseYaml(decoded) as Record<string, unknown>
        return extractProxies(doc)
      } catch {
        // Try one more Base64 layer
        if (looksLikeBase64(decoded)) {
          decoded = base64Decode(decoded).trim()
          if (isShareLinkContent(decoded)) {
            return parseShareLinks(decoded)
          }
          if (isYaml(decoded)) {
            try {
              const doc2 = parseYaml(decoded) as Record<string, unknown>
              return extractProxies(doc2)
            } catch { /* fall through */ }
          }
        }
      }
    }

    // If nothing matched, try parsing decoded as plain share links anyway
    const proxies = parseShareLinks(decoded)
    if (proxies.length > 0) return proxies
  }

  return []
}

// ──────────────────────────────────────────────
// HTTP fetch
// ──────────────────────────────────────────────

/** Clash-compatible User-Agent strings to try */
const UA_LIST = [
  'ClashX/1.0',
  'ClashForAndroid/3.0',
  'clash-verge/2.0',
  'clash/1.0',
  'Clash.Meta/1.0',
]

export async function fetchAndParse(url: string): Promise<ClashProxy[]> {
  try {
    // Rotate through Clash-compatible UAs so providers return proper format
    const ua = UA_LIST[Math.floor(Math.random() * UA_LIST.length)]
    const response = await fetch(url, {
      headers: {
        'User-Agent': ua,
        Accept: 'text/plain, application/yaml, */*',
        'Profile-Update-Interval': '24',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return []
    const text = await response.text()
    return parseContent(text)
  } catch {
    return []
  }
}

// ──────────────────────────────────────────────
// Multi-subscription resolver
// ──────────────────────────────────────────────

export async function resolveInput(urlParam: string): Promise<ClashProxy[]> {
  const urls = urlParam.split('|').map(u => u.trim()).filter(Boolean)
  const allProxies: ClashProxy[] = []
  const seen = new Set<string>()

  for (const rawUrl of urls) {
    let url = rawUrl
    try {
      url = decodeURIComponent(rawUrl)
    } catch {
      // already decoded or invalid
    }

    const proxies = await fetchAndParse(url)
    for (const p of proxies) {
      const key = `${p.type}:${p.server}:${p.port}:${p.name}`
      if (!seen.has(key)) {
        seen.add(key)
        allProxies.push(p)
      }
    }
  }

  return allProxies
}
