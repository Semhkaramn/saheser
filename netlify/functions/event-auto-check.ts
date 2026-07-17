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

const handler = schedule('*/30 * * * *', async () => {
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

    console.log('🔄 Running event auto-check...')

    // 8 second timeout for API call
    const response = await fetchWithTimeout(`${siteUrl}/api/admin/events/auto-check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
      },
    }, 8000)

    if (!response.ok) {
      const text = await response.text()
      console.error('Event auto-check API error:', response.status, text)
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
    console.log('✅ Event auto-check completed:', data)

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    console.error('❌ Error in event auto-check:', isTimeout ? 'Request timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent retries
      body: JSON.stringify({
        error: isTimeout ? 'Request timeout' : 'Failed to run auto-check',
        message: errorMessage
      }),
    }
  }
})

export { handler }
