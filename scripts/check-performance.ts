#!/usr/bin/env bun

/**
 * Performance Check Script
 *
 * Analyzes cache performance, API metrics, and provides recommendations
 *
 * Usage: bun run perf:check
 */

import { Redis } from '@upstash/redis'

async function checkPerformance() {
  console.log('📊 Performance Analysis\n')
  console.log('═'.repeat(60))
  console.log('\n')

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('⚠️  Redis not configured - skipping Redis metrics')
    console.log('   Configure Redis for better performance insights\n')
    return
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  })

  try {
    // 1. Cache Performance
    console.log('🗄️  CACHE PERFORMANCE')
    console.log('─'.repeat(60))

    const cacheKeys = await redis.keys('cache:*')
    console.log(`   Total cache keys: ${cacheKeys.length}`)

    // Breakdown by type
    const leaderboardKeys = cacheKeys.filter(k => k.includes('leaderboard'))
    const wheelKeys = cacheKeys.filter(k => k.includes('wheel'))
    const userKeys = cacheKeys.filter(k => k.includes('user'))
    const settingsKeys = cacheKeys.filter(k => k.includes('settings'))

    console.log(`   ├─ Leaderboard: ${leaderboardKeys.length}`)
    console.log(`   ├─ Wheel: ${wheelKeys.length}`)
    console.log(`   ├─ User: ${userKeys.length}`)
    console.log(`   └─ Settings: ${settingsKeys.length}`)
    console.log()

    // 2. Session Tracking
    console.log('👥 SESSION TRACKING')
    console.log('─'.repeat(60))

    const sessionKeys = await redis.keys('session:*')
    const userSessionKeys = await redis.keys('user_sessions:*')

    console.log(`   Active sessions: ${sessionKeys.length}`)
    console.log(`   Users with sessions: ${userSessionKeys.length}`)
    console.log()

    // 3. Rate Limiting
    console.log('🚦 RATE LIMITING')
    console.log('─'.repeat(60))

    const rateLimitKeys = await redis.keys('ratelimit:*')
    console.log(`   Active rate limits: ${rateLimitKeys.length}`)

    // Sample some rate limits
    if (rateLimitKeys.length > 0) {
      console.log(`   Recent rate limited requests:`)
      const samples = rateLimitKeys.slice(0, 5)
      for (const key of samples) {
        const count = await redis.get<number>(key)
        const ttl = await redis.ttl(key)
        console.log(`   ├─ ${key.replace('ratelimit:', '')}: ${count} requests (TTL: ${ttl}s)`)
      }
    }
    console.log()

    // 4. Visit Tracking Buffer
    console.log('📈 VISIT TRACKING')
    console.log('─'.repeat(60))

    const visitBufferSize = await redis.llen('visit_tracking_buffer')
    console.log(`   Buffered visits: ${visitBufferSize}`)

    if (visitBufferSize > 0) {
      // Show sample visit
      const sample = await redis.lrange('visit_tracking_buffer', 0, 0)
      if (sample.length > 0) {
        const visit = JSON.parse(sample[0])
        console.log(`   Latest visit:`)
        console.log(`   ├─ Page: ${visit.page}`)
        console.log(`   ├─ IP: ${visit.ipAddress}`)
        console.log(`   └─ Time: ${new Date(visit.timestamp).toLocaleString()}`)
      }
    }
    console.log()

    // 5. API Metrics
    console.log('⚡ API METRICS')
    console.log('─'.repeat(60))

    const metricsKeys = await redis.keys('api_metrics:stats:*')
    console.log(`   Tracked endpoints: ${metricsKeys.length}`)

    if (metricsKeys.length > 0) {
      console.log(`   Top endpoints by requests:`)

      const endpointStats = await Promise.all(
        metricsKeys.slice(0, 10).map(async (key) => {
          const stats = await redis.get<any>(key)
          return {
            endpoint: key.replace('api_metrics:stats:', ''),
            stats
          }
        })
      )

      // Sort by total requests
      endpointStats
        .filter(e => e.stats)
        .sort((a, b) => (b.stats?.totalRequests || 0) - (a.stats?.totalRequests || 0))
        .slice(0, 5)
        .forEach(({ endpoint, stats }) => {
          const avgTime = Math.round(stats.totalDuration / stats.totalRequests)
          const successRate = Math.round((stats.successCount / stats.totalRequests) * 100)
          console.log(`   ├─ ${endpoint}`)
          console.log(`   │  Requests: ${stats.totalRequests} | Avg: ${avgTime}ms | Success: ${successRate}%`)
        })
    }
    console.log()

    // 6. Recommendations
    console.log('💡 RECOMMENDATIONS')
    console.log('─'.repeat(60))

    const recommendations: string[] = []

    // Check cache usage
    if (cacheKeys.length === 0) {
      recommendations.push('⚠️  No cache keys found - caching may not be working')
    } else if (cacheKeys.length > 1000) {
      recommendations.push('💾 High cache usage - consider cleaning old keys')
    } else {
      recommendations.push('✅ Cache usage looks healthy')
    }

    // Check visit buffer
    if (visitBufferSize > 500) {
      recommendations.push('📊 Visit buffer is large - scheduled function may need attention')
    } else if (visitBufferSize === 0) {
      recommendations.push('📈 No buffered visits - either low traffic or batch insert working well')
    }

    // Check sessions
    if (sessionKeys.length > 1000) {
      recommendations.push('👥 Many active sessions - cleanup working properly')
    }

    // Check rate limits
    if (rateLimitKeys.length > 100) {
      recommendations.push('🚨 High rate limit activity - possible bot traffic or DDoS')
    }

    recommendations.forEach(rec => console.log(`   ${rec}`))
    console.log()

    // 7. Memory Usage Estimate
    console.log('💾 ESTIMATED REDIS MEMORY')
    console.log('─'.repeat(60))

    const totalKeys = cacheKeys.length + sessionKeys.length + rateLimitKeys.length
    const estimatedBytes = totalKeys * 2000 // rough estimate: 2KB per key
    const estimatedMB = (estimatedBytes / 1024 / 1024).toFixed(2)

    console.log(`   Total keys: ${totalKeys}`)
    console.log(`   Estimated size: ~${estimatedMB} MB`)
    console.log(`   Upstash limit: 256 MB (free tier)`)
    console.log(`   Usage: ~${((Number(estimatedMB) / 256) * 100).toFixed(1)}%`)
    console.log()

    console.log('═'.repeat(60))
    console.log('✅ Performance check complete!\n')

  } catch (error) {
    console.error('❌ Performance check failed:', error)
    process.exit(1)
  }
}

checkPerformance()
