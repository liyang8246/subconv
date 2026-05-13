// ============================================================
// POST /api/sub — Subscription conversion endpoint
// ============================================================

import type { ConvertOptions, ConvertResult } from '../engine/types'
import { resolveInput } from '../engine/parser'
import { processProxies } from '../engine/pipeline'
import { generateClashConfig } from '../engine/generator'

export default defineEventHandler(async (event): Promise<ConvertResult | { error: string }> => {
  const body = await readBody(event)

  if (!body || !body.url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameter: url',
    })
  }

  const options: ConvertOptions = {
    target: 'clash',
    url: String(body.url),
    preset: body.preset ?? '',
    emoji: body.emoji !== false,
    exclude: body.exclude || undefined,
    include: body.include || undefined,
    rename: body.rename || undefined,
    udp: body.udp ?? undefined,
    tfo: body.tfo ?? undefined,
    scv: body.scv ?? undefined,
  }

  try {
    // 1. Fetch and parse subscription(s)
    const rawProxies = await resolveInput(options.url)
    if (rawProxies.length === 0) {
      return { config: '# No proxies found', proxyCount: 0, ruleCount: 0 }
    }

    // 2. Run the processing pipeline
    const processed = processProxies(rawProxies, options)

    // 3. Generate Clash config
    const config = generateClashConfig(processed, {
      preset: options.preset,
      port: body.port ?? 7890,
      socksPort: body.socksPort ?? 7891,
      mode: body.mode ?? 'rule',
    })

    // Count rules in the output
    const ruleCount = (config.match(/^ {2}- /gm) || []).length - processed.length

    return {
      config,
      proxyCount: processed.length,
      ruleCount: Math.max(0, ruleCount),
    }
  }
  catch (err) {
    console.error('Conversion error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: `Conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    })
  }
})
