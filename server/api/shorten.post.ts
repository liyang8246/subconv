// @env node
export default defineEventHandler(async (event) => {
  const body = await readBody<{ longUrl: string, service?: string }>(event)

  if (!body?.longUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Missing longUrl' })
  }

  const service = body.service || 'v1.mk'
  const apiUrl = `https://${service}/short`

  try {
    const res = await $fetch<{ Code: number, ShortUrl?: string, Message?: string }>(apiUrl, {
      method: 'POST',
      body: { longUrl: body.longUrl },
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.Code === 1 && res.ShortUrl) {
      return { shortUrl: res.ShortUrl }
    }

    throw createError({
      statusCode: 400,
      statusMessage: res.Message || 'Shorten failed',
    })
  }
  catch (err: unknown) {
    if (isErrorWithStatusCode(err)) throw err
    throw createError({
      statusCode: 500,
      statusMessage: `Shorten failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    })
  }
})

function isErrorWithStatusCode(err: unknown): err is { statusCode: number } {
  return typeof err === 'object' && err !== null && 'statusCode' in err
}
