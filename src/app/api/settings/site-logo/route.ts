import { NextResponse } from 'next/server'
import { SiteConfig } from '@/lib/site-config'

// 🚀 OPTIMIZED: Static logo from public folder (CDN optimized)
export const revalidate = 3600 // 1 hour (logo rarely changes)

export async function GET() {
  try {
    // 🚀 OPTIMIZED: Logo from ENV (static file in public folder)
    // Much faster than DB or Cloudinary - served directly by CDN
    const logoUrl = SiteConfig.siteLogo
    const version = Date.now().toString() // Version for cache busting

    return NextResponse.json(
      {
        logoUrl,
        version
      },
      {
        headers: {
          // Aggressive caching for static logo
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    )
  } catch (error) {
    console.error('Error fetching site logo:', error)
    return NextResponse.json({
      logoUrl: '/logo.webp', // Fallback
      version: null
    })
  }
}
