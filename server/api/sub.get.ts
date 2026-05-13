// @env node
import type { ConvertOptions } from '../engine/types'
import { resolveInput } from '../engine/parser'
import { processProxies } from '../engine/pipeline'
import { generateClashConfig } from '../engine/generator'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (!query.url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameter: url',
    })
  }

  const options: ConvertOptions = {
    target: 'clash',
    url: String(query.url),
    preset: String(query.preset ?? ''),
    emoji: query.emoji !== 'false',
    exclude: query.exclude ? String(query.exclude) : undefined,
    include: query.include ? String(query.include) : undefined,
    rename: query.rename ? JSON.parse(String(query.rename)) : undefined,
    udp: query.udp === 'true' ? true : undefined,
    tfo: query.tfo === 'true' ? true : undefined,
    scv: query.scv === 'true' ? true : undefined,
  }

  try {
    const { proxies: rawProxies, filename: upstreamFilename, userinfo } = await resolveInput(options.url)
    if (rawProxies.length === 0) {
      setHeader(event, 'content-type', 'text/plain')
      return '# No proxies found'
    }

    const processed = processProxies(rawProxies, options)
    const config = generateClashConfig(processed, {
      preset: options.preset,
      port: Number(query.port) || 7890,
      socksPort: Number(query.socksPort) || 7891,
      mode: String(query.mode ?? 'rule'),
    })

    setHeader(event, 'content-type', 'text/yaml; charset=utf-8')

    // Forward upstream subscription-userinfo so Clash clients show traffic / expiry
    if (userinfo) setHeader(event, 'subscription-userinfo', userinfo)

    const filename = String(query.filename || upstreamFilename || 'subscription')
    const encoded = encodeURIComponent(filename)
    setHeader(event, 'content-disposition', `attachment; filename="${encoded}.yaml"; filename*=UTF-8''${encoded}.yaml`)

    return config
  }
  catch (err) {
    console.error('Conversion error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    })
  }
})
