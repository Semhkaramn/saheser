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

// Her saat başı çalışır; sadece Pazar günü ve ayarlanan saatte gerçek işlem yapar
const handler = schedule('0 * * * *', async () => {
  try {
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-this'

    if (!siteUrl) {
      return { statusCode: 200, body: JSON.stringify({ error: 'Site URL not configured' }) }
    }

    const response = await fetchWithTimeout(`${siteUrl}/api/cron/weekly-rewards`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}`, 'Content-Type': 'application/json' },
    }, 25000)

    const data = await response.json()
    console.log('✅ Weekly rewards cron completed:', data)

    return { statusCode: 200, body: JSON.stringify(data) }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ Error in weekly rewards cron:', errorMessage)
    return { statusCode: 200, body: JSON.stringify({ error: errorMessage }) }
  }
})

export { handler }
