// @env node
// Subscription parser: detect format (YAML / Base64 / share links), decode, extract proxies
import type { ClashProxy } from './types'
import { parse as parseYaml } from 'yaml'

// ── URL helpers (eliminate repetition across protocol parsers) ──

function safeUrl(uri: string): URL | null {
  try { return new URL(uri) } catch { return null }
}

function extractName(url: URL, server: string, port: number): string {
  try {
    return decodeURIComponent(url.hash?.replace('#', '') || `${server}:${port}`)
  }
  catch {
    return `${server}:${port}`
  }
}

function getPort(url: URL, fallback = 443): number {
  return Number.parseInt(url.port) || fallback
}

// ── Format detection ──

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
  }
  catch {
    return str
  }
}

function looksLikeBase64(str: string): boolean {
  const trimmed = str.trim()
  if (trimmed.length === 0) return false
  if (isYaml(trimmed) || isShareLinkContent(trimmed)) return false
  return /^[A-Za-z0-9+/=\s\r\n]+$/.test(trimmed) && trimmed.length > 20
}

function urlSafeBase64Decode(str: string): string {
  try {
    const base64 = str
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(padded, 'base64').toString('utf-8')
  }
  catch {
    return str
  }
}

// ── YAML parsing ──

function tryParseYaml(text: string): ClashProxy[] {
  try {
    const doc = parseYaml(text) as Record<string, unknown>
    if (doc && typeof doc === 'object') {
      return extractProxies(doc)
    }
  }
  catch { /* not valid YAML */ }
  return []
}

function extractProxies(doc: Record<string, unknown>): ClashProxy[] {
  const raw = (doc.proxies || doc.Proxy || []) as ClashProxy[]
  return raw.map(p => ({
    ...p,
    name: String(p.name ?? ''),
    type: String(p.type ?? ''),
    server: String(p.server ?? ''),
    port: Number(p.port ?? 0),
  }))
}

// ── Content-Disposition parsing ──

function extractFilename(cd: string | null): string | undefined {
  if (!cd) return undefined

  // 1. Prefer RFC 5987 filename*=charset'lang'percent-encoded
  const starMatch = cd.match(/filename\*=(?:"[^"]*"|'[^']*'|(?:UTF-8|utf-8)''([^;]*)|[^;]*)/i)
  if (starMatch) {
    const encoded = starMatch[1] || starMatch[0].split("''")[1] || ''
    if (encoded) {
      try {
        return decodeURIComponent(encoded.trim()).replace(/\.(yaml|yml)$/i, '')
      }
      catch {
        return encoded.trim().replace(/\.(yaml|yml)$/i, '')
      }
    }
  }

  // 2. Fallback to plain filename="..."
  const plainMatch = cd.match(/filename\s*=\s*((['"])(.*?)\2|[^;]*)/i)
  if (plainMatch) {
    return (plainMatch[3] || plainMatch[1]).replace(/['"]/g, '').replace(/\.(yaml|yml)$/i, '')
  }

  return undefined
}

// ── Share link parsers ──

/** Parse SS link: ss://base64(method:password)@server:port#name or ss://method:password@server:port#name */
function parseSS(uri: string): ClashProxy | null {
  try {
    const url = safeUrl(uri)
    if (!url) return null

    const server = url.hostname
    const port = getPort(url, 8388)
    const name = extractName(url, server, port)

    // SIP002 with password in URL: ss://method:password@server:port
    // url.password is non-empty → method is username, password is url.password
    // Otherwise userInfo might be base64-encoded (original style) or method:password in username
    let method: string
    let password: string

    if (url.password) {
      method = decodeURIComponent(url.username)
      password = decodeURIComponent(url.password)
    }
    else {
      const userInfo = decodeURIComponent(url.username)
      if (!userInfo) return null

      if (/^[A-Za-z0-9+/=]+$/.test(userInfo) && userInfo.length > 4) {
        const decoded = urlSafeBase64Decode(userInfo)
        const colon = decoded.indexOf(':')
        if (colon === -1) return null
        method = decoded.slice(0, colon)
        password = decoded.slice(colon + 1)
      }
      else {
        const colon = userInfo.indexOf(':')
        if (colon === -1) return null
        method = userInfo.slice(0, colon)
        password = userInfo.slice(colon + 1)
      }
    }

    if (!method) return null

    const result: Record<string, unknown> = {
      name,
      type: 'ss',
      server,
      port,
      cipher: method,
      password,
    }

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
  }
  catch {
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
      'name': cfg.ps || cfg.remark || `${cfg.add}:${cfg.port}`,
      'type': 'vmess',
      'server': cfg.add || cfg.host || '',
      'port': Number.parseInt(cfg.port) || 443,
      'uuid': cfg.id || '',
      'alterId': cfg.aid ?? 0,
      'cipher': cfg.scy || cfg.security || 'auto',
      'network': cfg.net || 'tcp',
      'ws-opts': cfg.net === 'ws'
        ? {
          path: cfg.path || '/',
          headers: { Host: cfg.host || cfg.sni || '' },
        }
        : undefined,
      'tls': cfg.tls === 'tls',
      'servername': cfg.sni || undefined,
    } as ClashProxy
  }
  catch {
    return null
  }
}

/** Parse SSR link: ssr://base64(...) */
function parseSSR(uri: string): ClashProxy | null {
  try {
    const body = uri.replace('ssr://', '')
    const decoded = urlSafeBase64Decode(body.trim())

    const mainAndParams = decoded.split('/?')
    const main = mainAndParams[0].split(':')

    if (main.length < 6) return null

    const server = main[0]
    const port = Number.parseInt(main[1]) || 443
    const protocol = main[2]
    const method = main[3]
    const obfs = main[4]
    const password = urlSafeBase64Decode(main[5])

    const params = new URLSearchParams(mainAndParams[1] || '')
    const name = urlSafeBase64Decode(params.get('remarks') || '') || `${server}:${port}`
    const obfsParam = urlSafeBase64Decode(params.get('obfsparam') || '')
    const protocolParam = urlSafeBase64Decode(params.get('protoparam') || '')

    return {
      name,
      'type': 'ssr',
      server,
      port,
      'cipher': method,
      password,
      protocol,
      'protocol-param': protocolParam || undefined,
      obfs,
      'obfs-param': obfsParam || undefined,
    } as ClashProxy
  }
  catch {
    return null
  }
}

/** Parse Trojan link: trojan://password@server:port?peer=sni&allowInsecure=1#name */
function parseTrojan(uri: string): ClashProxy | null {
  try {
    const url = safeUrl(uri)
    if (!url) return null

    const password = url.username || url.password
    const server = url.hostname
    const port = getPort(url)
    const name = extractName(url, server, port)
    const sni = url.searchParams.get('sni') || url.searchParams.get('peer') || server
    const skipCert = url.searchParams.get('allowInsecure') === '1' || url.searchParams.get('skip-cert-verify') === 'true'

    return {
      name,
      'type': 'trojan',
      server,
      port,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      'udp': url.searchParams.has('udp') ? url.searchParams.get('udp') === '1' : undefined,
    } as ClashProxy
  }
  catch {
    return null
  }
}

/** Parse VLESS link: vless://uuid@server:port?encryption=none&security=tls&type=ws&... */
function parseVLESS(uri: string): ClashProxy | null {
  try {
    const url = safeUrl(uri)
    if (!url) return null

    const uuid = url.username
    const server = url.hostname
    const port = getPort(url)
    const name = extractName(url, server, port)

    const security = url.searchParams.get('security') || 'none'
    const encryption = url.searchParams.get('encryption') || 'none'
    const networkType = url.searchParams.get('type') || 'tcp'
    const sni = url.searchParams.get('sni') || server
    const flow = url.searchParams.get('flow') || undefined
    const realityKey = url.searchParams.get('pbk') || undefined
    const fingerprint = url.searchParams.get('fp') || undefined

    const result: Record<string, unknown> = {
      name,
      'type': 'vless',
      server,
      port,
      uuid,
      encryption,
      'network': networkType,
      sni,
      'servername': sni,
      'flow': flow || undefined,
      'reality-opts': realityKey
        ? {
          'public-key': realityKey,
          'short-id': url.searchParams.get('sid') || '',
        }
        : undefined,
      fingerprint,
    }

    if (security === 'tls' || security === 'reality') {
      result.tls = true
    }

    if (networkType === 'ws') {
      result['ws-opts'] = {
        path: url.searchParams.get('path') || '/',
        headers: {
          Host: url.searchParams.get('host') || sni,
        },
      }
    }

    if (networkType === 'grpc') {
      result['grpc-opts'] = {
        'grpc-service-name': url.searchParams.get('serviceName') || '',
      }
    }

    return result as ClashProxy
  }
  catch {
    return null
  }
}

/** Parse Hysteria2 link: hysteria2://password@server:port?sni=...&insecure=1&... */
function parseHysteria2(uri: string): ClashProxy | null {
  try {
    const url = safeUrl(uri)
    if (!url) return null

    const password = url.username
    const server = url.hostname
    const port = getPort(url)
    const name = extractName(url, server, port)
    const sni = url.searchParams.get('sni') || server
    const skipCert = url.searchParams.get('insecure') === '1'
    const obfs = url.searchParams.get('obfs') || undefined
    const obfsPassword = url.searchParams.get('obfs-password') || undefined
    const upMbps = url.searchParams.has('upmbps') ? Number(url.searchParams.get('upmbps')) : undefined
    const downMbps = url.searchParams.has('downmbps') ? Number(url.searchParams.get('downmbps')) : undefined

    return {
      name,
      'type': 'hysteria2',
      server,
      port,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      obfs,
      'obfs-password': obfsPassword,
      'up': upMbps,
      'down': downMbps,
    } as ClashProxy
  }
  catch {
    return null
  }
}

/** Parse TUIC link: tuic://uuid:password@server:port?sni=...&... */
function parseTUIC(uri: string): ClashProxy | null {
  try {
    const url = safeUrl(uri)
    if (!url) return null

    const uuid = url.username
    const password = url.password
    const server = url.hostname
    const port = getPort(url)
    const name = extractName(url, server, port)
    const sni = url.searchParams.get('sni') || server
    const skipCert = url.searchParams.get('allow_insecure') === '1'
    const alpn = url.searchParams.get('alpn') ? url.searchParams.get('alpn')!.split(',') : undefined
    const congestion = url.searchParams.get('congestion_control') || 'cubic'

    return {
      name,
      'type': 'tuic',
      server,
      port,
      uuid,
      password,
      sni,
      'skip-cert-verify': skipCert || undefined,
      alpn,
      'congestion-controller': congestion,
    } as ClashProxy
  }
  catch {
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
  if (trimmed.startsWith('hysteria://')) return parseHysteria2(trimmed)
  if (trimmed.startsWith('tuic://')) return parseTUIC(trimmed)

  return null
}

/**
 * Parse a block of share links (one per line) into ClashProxy[].
 * Each line is a share link like ss://... or vmess://...
 */
function parseShareLinks(content: string): ClashProxy[] {
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

// ── Main content parsing ──

/**
 * Parse any subscription content.
 * Detects: YAML, Base64→YAML, Base64→share links, raw share links.
 *
 * Priority: YAML → share links → base64 decode → (share links → YAML → double-base64)
 */
function parseContent(text: string): ClashProxy[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Collect candidates: raw text + optional base64-decoded layers
  const candidates = [trimmed]

  if (looksLikeBase64(trimmed)) {
    const decoded = base64Decode(trimmed).trim()
    candidates.push(decoded)
    if (looksLikeBase64(decoded)) {
      candidates.push(base64Decode(decoded).trim())
    }
  }

  for (const candidate of candidates) {
    // Try YAML
    if (isYaml(candidate)) {
      const proxies = tryParseYaml(candidate)
      if (proxies.length > 0) return proxies
    }

    // Try share links
    if (isShareLinkContent(candidate)) {
      const proxies = parseShareLinks(candidate)
      if (proxies.length > 0) return proxies
    }

    // Fallback: try as share links even if not detected by isShareLinkContent
    const proxies = parseShareLinks(candidate)
    if (proxies.length > 0) return proxies
  }

  return []
}

// ── HTTP fetching ──

export async function fetchAndParse(url: string, userAgent?: string): Promise<{ proxies: ClashProxy[], filename?: string, userinfo?: string }> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'text/plain, application/yaml, */*',
      'Profile-Update-Interval': '24',
    }
    if (userAgent) headers['User-Agent'] = userAgent

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) return { proxies: [] }

    // Forward upstream subscription-userinfo (traffic/expiry) so Clash clients can display it
    const userinfo = response.headers.get('subscription-userinfo') || undefined

    const filename = extractFilename(response.headers.get('content-disposition'))

    const text = await response.text()
    const proxies = parseContent(text)
    return { proxies, filename, userinfo }
  }
  catch {
    return { proxies: [] }
  }
}

// ── Userinfo handling (private) ──

interface UserinfoFields {
  upload?: number
  download?: number
  total?: number
  expire?: number
}

function parseUserinfo(header: string): UserinfoFields {
  const fields: UserinfoFields = {}
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const val = Number(part.slice(eq + 1).trim())
    if (Number.isNaN(val)) continue
    switch (key) {
      case 'upload': fields.upload = val; break
      case 'download': fields.download = val; break
      case 'total': fields.total = val; break
      case 'expire': fields.expire = val; break
    }
  }
  return fields
}

function serializeUserinfo(fields: UserinfoFields): string {
  const parts: string[] = []
  if (fields.upload !== undefined) parts.push(`upload=${Math.round(fields.upload)}`)
  if (fields.download !== undefined) parts.push(`download=${Math.round(fields.download)}`)
  if (fields.total !== undefined) parts.push(`total=${Math.round(fields.total)}`)
  if (fields.expire !== undefined) parts.push(`expire=${Math.round(fields.expire)}`)
  return parts.join('; ')
}

/**
 * Merge multiple subscription-userinfo headers.
 * upload / download / total are summed (traffic pools).
 * expire takes the earliest (safest conservative estimate).
 */
function mergeUserinfo(all: UserinfoFields[]): UserinfoFields | undefined {
  if (all.length === 0) return undefined

  const merged: UserinfoFields = {}
  let hasTraffic = false

  for (const f of all) {
    if (f.upload !== undefined || f.download !== undefined || f.total !== undefined) {
      merged.upload = (merged.upload ?? 0) + (f.upload ?? 0)
      merged.download = (merged.download ?? 0) + (f.download ?? 0)
      merged.total = (merged.total ?? 0) + (f.total ?? 0)
      hasTraffic = true
    }
    if (f.expire !== undefined) {
      merged.expire = merged.expire !== undefined ? Math.min(merged.expire, f.expire) : f.expire
    }
  }

  return hasTraffic || merged.expire !== undefined ? merged : undefined
}

// ── Multi-URL resolution ──

export async function resolveInput(urlParam: string, userAgent?: string): Promise<{ proxies: ClashProxy[], filename?: string, userinfo?: string }> {
  const urls = urlParam.split('|').map(u => u.trim()).filter(Boolean)
  const allProxies: ClashProxy[] = []
  const seen = new Set<string>()
  let firstFilename: string | undefined
  const userinfos: UserinfoFields[] = []

  for (const rawUrl of urls) {
    let url = rawUrl
    try {
      url = decodeURIComponent(rawUrl)
    }
    catch { /* already decoded */ }

    const { proxies, filename, userinfo: ui } = await fetchAndParse(url, userAgent)
    if (filename && !firstFilename) firstFilename = filename
    if (ui) userinfos.push(parseUserinfo(ui))

    for (const p of proxies) {
      const key = `${p.type}:${p.server}:${p.port}:${p.name}`
      if (!seen.has(key)) {
        seen.add(key)
        allProxies.push(p)
      }
    }
  }

  const merged = mergeUserinfo(userinfos)
  return {
    proxies: allProxies,
    filename: firstFilename,
    userinfo: merged ? serializeUserinfo(merged) : undefined,
  }
}
