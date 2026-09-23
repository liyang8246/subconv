// @env node
import { Base64 } from 'js-base64'
import { resolveInput } from '../engine/parser'
import { buildClashConfig, stringifyConfig } from '../engine/generator'
import { runScript, ScriptError, MAX_SCRIPT_BYTES } from '../engine/script'
import { getPresetByName } from '../codegen'

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
  const scriptParam = query.script ? String(query.script) : ''

  try {
    const userAgent = getHeader(event, 'user-agent')
    const { proxies, filename: upstreamFilename, userinfo } = await resolveInput(url, userAgent)
    if (proxies.length === 0) {
      setHeader(event, 'content-type', 'text/plain')
      return '# No proxies found'
    }

    let config = buildClashConfig(proxies, preset || undefined)

    if (scriptParam) {
      const script = Base64.decode(scriptParam)
      if (Buffer.byteLength(script, 'utf-8') > MAX_SCRIPT_BYTES) {
        throw createError({ statusCode: 400, statusMessage: 'Script too large' })
      }

      if (script.trim()) {
        const profileName = getPresetByName(preset)?.name || preset || upstreamFilename || 'default'
        try {
          config = await runScript(script, config, profileName)
        }
        catch (err) {
          throw createError({
            statusCode: 400,
            statusMessage: err instanceof ScriptError
              ? `Script error: ${err.message}`
              : `Script error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          })
        }
      }
    }

    const yaml = stringifyConfig(config)

    setHeader(event, 'content-type', 'text/yaml; charset=utf-8')
    if (userinfo) setHeader(event, 'subscription-userinfo', userinfo)

    const filename = upstreamFilename || 'subscription'
    const encoded = encodeURIComponent(filename)
    setHeader(event, 'content-disposition', `attachment; filename="${encoded}.yaml"; filename*=UTF-8''${encoded}.yaml`)

    return yaml
  }
  catch (err) {
    if (isErrorWithStatusCode(err)) throw err
    console.error('Conversion error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    })
  }
})

function isErrorWithStatusCode(err: unknown): err is { statusCode: number } {
  return typeof err === 'object' && err !== null && 'statusCode' in err
}
