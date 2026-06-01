// @env node
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

  const url = String(query.url)
  const preset = String(query.preset ?? '')

  try {
    const userAgent = getHeader(event, 'user-agent')
    const { proxies: rawProxies, filename: upstreamFilename, userinfo } = await resolveInput(url, userAgent)
    if (rawProxies.length === 0) {
      setHeader(event, 'content-type', 'text/plain')
      return '# No proxies found'
    }

    const processed = processProxies(rawProxies)
    const config = generateClashConfig(processed, { preset })

    setHeader(event, 'content-type', 'text/yaml; charset=utf-8')

    // Forward upstream subscription-userinfo so Clash clients show traffic / expiry
    if (userinfo) setHeader(event, 'subscription-userinfo', userinfo)

    const filename = upstreamFilename || 'subscription'
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
