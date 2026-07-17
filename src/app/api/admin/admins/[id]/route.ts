import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { requirePermission } from '@/lib/admin-middleware'

// GET - Tek admin bilgisi
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessAdmins')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const admin = await prisma.admin.findUnique({
      where: { id },
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
      }
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(admin)
  } catch (error) {
    console.error('Error fetching admin:', error)
    return NextResponse.json(
      { error: 'Failed to fetch admin' },
      { status: 500 }
    )
  }
}

// PUT - Admin güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessAdmins')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    const body = await request.json()
    const { permissions } = body

    // Super admin'i güncelleyemezsiniz
    const targetAdmin = await prisma.admin.findUnique({
      where: { id }
    })

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    if (targetAdmin.isSuperAdmin && !authCheck.admin?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Cannot modify super admin' },
        { status: 403 }
      )
    }

    // Sadece permissions'ı güncelle
    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: {
        canAccessUsers: permissions.canAccessUsers,
        canAccessTasks: permissions.canAccessTasks,
        canAccessShop: permissions.canAccessShop,
        canAccessWheel: permissions.canAccessWheel,
        canAccessSponsors: permissions.canAccessSponsors,
        canAccessAds: permissions.canAccessAds,
        canAccessRanks: permissions.canAccessRanks,
        canAccessSettings: permissions.canAccessSettings,
        canAccessAdmins: permissions.canAccessAdmins,
        canAccessTickets: permissions.canAccessTickets,
        canAccessEvents: permissions.canAccessEvents,
        canAccessPromocodes: permissions.canAccessPromocodes,
        canAccessActivityLogs: permissions.canAccessActivityLogs,
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
        updatedAt: true,
      }
    })

    return NextResponse.json({
      success: true,
      admin: updatedAdmin
    })
  } catch (error) {
    console.error('Error updating admin:', error)
    return NextResponse.json(
      { error: 'Failed to update admin' },
      { status: 500 }
    )
  }
}

// DELETE - Admin sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission(request, 'canAccessAdmins')
  if (authCheck.error) return authCheck.error

  const { id } = await params

  try {
    // Super admin'i silemezsiniz
    const targetAdmin = await prisma.admin.findUnique({
      where: { id }
    })

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      )
    }

    if (targetAdmin.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Cannot delete super admin' },
        { status: 403 }
      )
    }

    // Kendini silemezsin
    if (targetAdmin.id === authCheck.admin?.id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      )
    }

    await prisma.admin.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Admin deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting admin:', error)
    return NextResponse.json(
      { error: 'Failed to delete admin' },
      { status: 500 }
    )
  }
}
