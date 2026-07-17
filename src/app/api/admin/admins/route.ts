import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requirePermission } from '@/lib/admin-middleware'

// GET - Tüm adminleri listele
export async function GET(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessAdmins')
  if (authCheck.error) return authCheck.error

  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        canAccessUsers: true,
        canAccessTasks: true,
        canAccessShop: true,
        canAccessWheel: true,
        canAccessSponsors: true,
        canAccessAds: true,
        canAccessRanks: true,
        canAccessSettings: true,
        canAccessAdmins: true,
        canAccessTickets: true,
        canAccessEvents: true,
        canAccessPromocodes: true,
        canAccessActivityLogs: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { isSuperAdmin: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(admins)
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admins' },
      { status: 500 }
    )
  }
}

// POST - Yeni admin oluştur
export async function POST(request: NextRequest) {
  const authCheck = await requirePermission(request, 'canAccessAdmins')
  if (authCheck.error) return authCheck.error

  try {
    const body = await request.json()
    const {
      username,
      password,
      permissions = {}
    } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      )
    }

    // Username kontrolü
    const existingAdmin = await prisma.admin.findUnique({
      where: { username }
    })

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      )
    }

    // Şifreyi hashle
    const passwordHash = await bcrypt.hash(password, 10)

    // Yeni admin oluştur
    const newAdmin = await prisma.admin.create({
      data: {
        username,
        passwordHash,
        isSuperAdmin: false, // Normal adminler super admin olamaz
        canAccessUsers: permissions.canAccessUsers ?? false,
        canAccessTasks: permissions.canAccessTasks ?? false,
        canAccessShop: permissions.canAccessShop ?? false,
        canAccessWheel: permissions.canAccessWheel ?? false,
        canAccessSponsors: permissions.canAccessSponsors ?? false,
        canAccessAds: permissions.canAccessAds ?? false,
        canAccessRanks: permissions.canAccessRanks ?? false,
        canAccessSettings: permissions.canAccessSettings ?? false,
        canAccessAdmins: permissions.canAccessAdmins ?? false,
        canAccessTickets: permissions.canAccessTickets ?? false,
        canAccessEvents: permissions.canAccessEvents ?? false,
        canAccessPromocodes: permissions.canAccessPromocodes ?? false,
        canAccessActivityLogs: permissions.canAccessActivityLogs ?? false,
      },
      select: {
        id: true,
        username: true,
        isSuperAdmin: true,
        canAccessUsers: true,
        canAccessTasks: true,
        canAccessShop: true,
        canAccessWheel: true,
        canAccessSponsors: true,
        canAccessAds: true,
        canAccessRanks: true,
        canAccessSettings: true,
        canAccessAdmins: true,
        canAccessTickets: true,
        canAccessEvents: true,
        canAccessPromocodes: true,
        canAccessActivityLogs: true,
        createdAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      admin: newAdmin
    })
  } catch (error) {
    console.error('Error creating admin:', error)
    return NextResponse.json(
      { error: 'Failed to create admin' },
      { status: 500 }
    )
  }
}
