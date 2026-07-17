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

// Her gün Türkiye saati 00:00'da çalışır (UTC 21:00 = TR 00:00)
const handler = schedule('0 21 * * *', async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!siteUrl) {
      console.error('Site URL not found')
      return {
        statusCode: 200, // Return 200 to prevent Netlify from marking as failed
        body: JSON.stringify({ error: 'Site URL not configured' }),
      }
    }

    console.log('🎡 Running wheel reset notification...')

    // 8 second timeout for API call
    const response = await fetchWithTimeout(`${siteUrl}/api/admin/wheel/reset-notification`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    }, 8000)

    if (!response.ok) {
      const text = await response.text()
      console.error('Wheel reset notification API error:', response.status, text)
      return {
        statusCode: 200,
        body: JSON.stringify({
          error: 'API error',
          status: response.status,
          message: text.substring(0, 200)
        }),
      }
    }

    const data = await response.json()
    console.log('✅ Wheel reset notification completed:', data)

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    console.error('❌ Error in wheel reset notification:', isTimeout ? 'Request timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent retries
      body: JSON.stringify({
        error: isTimeout ? 'Request timeout' : 'Failed to send wheel reset notifications',
        message: errorMessage
      }),
    }
  }
})

export { handler }
