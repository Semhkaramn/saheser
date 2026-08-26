import { schedule } from '@netlify/functions'

// Timeout helper
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Her dakika çalışır - bekleyen bir Randy "başladı" DM bildirimi varsa
// (startRandy() artık bunu senkron göndermiyor, bkz. randy-bot-service.ts)
// arka planda, admin panelini bloke etmeden gönderir.
const handler = schedule('* * * * *', async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!siteUrl) {
      console.error('Site URL not found')
      return { statusCode: 200, body: JSON.stringify({ error: 'Site URL not configured' }) }
    }

    const response = await fetchWithTimeout(`${siteUrl}/api/admin/randy/process-dm-broadcast`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    }, 25000)

    if (!response.ok) {
      const text = await response.text()
      console.error('Randy DM broadcast API error:', response.status, text)
      return { statusCode: 200, body: JSON.stringify({ error: 'API error', status: response.status }) }
    }

    const data = await response.json()
    if (data.processed) {
      console.log('✅ Randy DM broadcast completed:', data)
    }

    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    console.error('❌ Error in Randy DM broadcast:', isTimeout ? 'Request timed out' : errorMessage)
    return {
      statusCode: 200,
      body: JSON.stringify({ error: isTimeout ? 'Request timeout' : 'Failed to process Randy DM broadcast', message: errorMessage }),
    }
  }
})

export { handler }
