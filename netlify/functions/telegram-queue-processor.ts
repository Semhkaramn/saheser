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

// 🔧 OPTIMIZATION: Her dakika yerine her 5 dakikada bir çalışır
// Bu değişiklik aylık ~120.000 request tasarrufu sağlar
const handler = schedule('*/5 * * * *', async () => {
  console.log('🕐 Scheduled queue processor running...')

  try {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || process.env.NEXT_PUBLIC_SITE_URL
    if (!siteUrl) {
      console.error('No site URL configured')
      return {
        statusCode: 200, // Return 200 to prevent Netlify from marking as failed
        body: JSON.stringify({ error: 'No site URL configured' }),
      }
    }

    const secret = process.env.QUEUE_PROCESS_SECRET || 'queue-process-internal'

    // 8 second timeout for API call
    const response = await fetchWithTimeout(`${siteUrl}/api/telegram/process-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-queue-secret': secret,
      },
    }, 8000)

    // Check if response is ok before parsing JSON
    if (!response.ok) {
      const text = await response.text()
      console.error('Queue processor API error:', response.status, text)
      return {
        statusCode: 200, // Return 200 to prevent Netlify from marking as failed
        body: JSON.stringify({
          error: 'API error',
          status: response.status,
          message: text.substring(0, 200)
        }),
      }
    }

    let data
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse response:', parseError)
      return {
        statusCode: 200,
        body: JSON.stringify({ error: 'Invalid JSON response' }),
      }
    }

    console.log('📊 Queue processor result:', data)

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = error instanceof Error && error.name === 'AbortError'

    console.error('Queue processor error:', isTimeout ? 'Request timed out' : errorMessage)

    return {
      statusCode: 200, // Return 200 to prevent Netlify from retrying
      body: JSON.stringify({
        error: isTimeout ? 'Request timeout' : 'Processing error',
        message: errorMessage
      }),
    }
  }
})

export { handler }
