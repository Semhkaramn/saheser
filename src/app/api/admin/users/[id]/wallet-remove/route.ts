import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/admin-middleware'

// ✅ TRC20 cüzdan adresi bir kere kaydedilince kullanıcı tarafından
// değiştirilemiyor/silinemiyor - sadece adminler kaldırabilir.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = await requirePermission(request, 'canAccessUsers')
  if (authCheck.error) return authCheck.error

  try {
    const { id } = await params
    const user = await prisma.user.findUnique({ where: { id } })

    if (!user || !user.trc20WalletAddress) {
      return NextResponse.json({ error: 'Kayıtlı cüzdan adresi yok' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id },
      data: { trc20WalletAddress: null }
    })

    console.log(`✅ Admin, kullanıcının cüzdan adresini kaldırdı: ${id}`)

    return NextResponse.json({ success: true, message: 'Cüzdan adresi kaldırıldı' })
  } catch (error) {
    console.error('Admin wallet remove error:', error)
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
  }
}
