import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-middleware'

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdmin(request)
    if (authCheck.error) return authCheck.error

    const admin = authCheck.admin!

    return NextResponse.json({
      id: admin.id,
      username: admin.username,
      isSuperAdmin: admin.isSuperAdmin,
      permissions: {
        canAccessUsers: admin.canAccessUsers,
        canAccessTasks: admin.canAccessTasks,
        canAccessShop: admin.canAccessShop,
        canAccessWheel: admin.canAccessWheel,
        canAccessSponsors: admin.canAccessSponsors,
        canAccessAds: admin.canAccessAds,
        canAccessRanks: admin.canAccessRanks,
        canAccessSettings: admin.canAccessSettings,
        canAccessAdmins: admin.canAccessAdmins,
        canAccessTickets: admin.canAccessTickets,
        canAccessEvents: admin.canAccessEvents,
        canAccessPromocodes: admin.canAccessPromocodes,
        canAccessActivityLogs: admin.canAccessActivityLogs,
      },
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching admin profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin profile' },
      { status: 500 }
    )
  }
}
