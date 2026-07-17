import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { invalidateCache } from '@/lib/enhanced-cache'
import { revalidatePath } from 'next/cache'
import { generateUniqueSlug } from '@/lib/slug'

// Cloudinary resim silme fonksiyonu
async function deleteFromCloudinary(publicId: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/upload`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ publicId }),
    });

    if (!response.ok) {
      console.error('Cloudinary silme hatası:', await response.text());
    }
  } catch (error) {
    console.error('Cloudinary silme hatası:', error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, price, imageUrl, imagePublicId, category, sponsorId, stock, purchaseLimit, isActive, order, requireApprovedSponsor } = body

    // Mevcut ürün bilgisini al
    const existingItem = await prisma.shopItem.findUnique({
      where: { id }
    });

    // Eğer resim değiştiyse, eski resmi Cloudinary'den sil
    if (imageUrl !== undefined && existingItem?.imagePublicId &&
        imageUrl !== existingItem.imageUrl) {
      await deleteFromCloudinary(existingItem.imagePublicId);
    }

    const updateData: any = {}
    if (name) {
      updateData.name = name
      // İsim değiştiyse slug'ı da güncelle (aynıysa mevcut URL bozulmasın)
      if (existingItem && existingItem.name !== name) {
        updateData.slug = await generateUniqueSlug(name, async (candidate) => {
          const existing = await prisma.shopItem.findFirst({ where: { slug: candidate, NOT: { id } } })
          return !!existing
        })
      }
    }
    if (description !== undefined) updateData.description = description
    if (typeof price === 'number') updateData.price = price
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl
    if (imagePublicId !== undefined) updateData.imagePublicId = imagePublicId
    if (category) updateData.category = category
    if (sponsorId !== undefined) updateData.sponsorId = sponsorId
    if (requireApprovedSponsor !== undefined) updateData.requireApprovedSponsor = Boolean(requireApprovedSponsor)
    if (stock !== undefined) updateData.stock = stock
    if (purchaseLimit !== undefined) updateData.purchaseLimit = purchaseLimit
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (typeof order === 'number') updateData.order = order

    const item = await prisma.shopItem.update({
      where: { id },
      data: updateData
    })

    // ✅ Cache invalidation
    invalidateCache.shop()
    revalidatePath('/shop')
    revalidatePath('/api/shop')
    console.log('🔄 Shop cache temizlendi (ürün güncellendi)')

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Update shop item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Ürün bilgisini al
    const item = await prisma.shopItem.findUnique({
      where: { id }
    });

    // Eğer resim varsa Cloudinary'den sil
    if (item?.imagePublicId) {
      await deleteFromCloudinary(item.imagePublicId);
    }

    await prisma.shopItem.delete({
      where: { id }
    })

    // ✅ Cache invalidation
    invalidateCache.shop()
    revalidatePath('/shop')
    revalidatePath('/api/shop')
    console.log('🔄 Shop cache temizlendi (ürün silindi)')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete shop item error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
