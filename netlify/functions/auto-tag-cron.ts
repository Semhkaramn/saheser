import { schedule } from '@netlify/functions'

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// Her 15 dakikada bir çalışır, süresi gelmiş grupları otomatik etiketler
const handler = schedule('*/15 * * * *', async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!siteUrl) {
      console.error('Site URL not found')
      return { statusCode: 200, body: JSON.stringify({ error: 'Site URL not configured' }) }
    }

    console.log('🏷️ Running auto-tag cron...')

    const response = await fetchWithTimeout(`${siteUrl}/api/cron/auto-tag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    }, 25000)

    const data = await response.json()
    console.log('✅ Auto-tag cron completed:', data)

    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in auto-tag cron:', errorMessage)
    return { statusCode: 200, body: JSON.stringify({ error: errorMessage }) }
  }
})

export { handler }
