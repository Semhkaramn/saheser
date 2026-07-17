import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { invalidateCache, enhancedCache, CacheKeys } from "@/lib/enhanced-cache";
import { logWalletChange, extractRequestInfo } from "@/lib/services/activity-log-service";

// Cüzdan adresini getir
export async function GET(request: NextRequest) {
  try {
    // Session kontrolü - artık query parametresi yerine session kullanıyoruz
    const session = await requireAuth(request);
    const userId = session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { trc20WalletAddress: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Kullanıcı bulunamadı" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      walletAddress: user.trc20WalletAddress,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      );
    }
    console.error("Cüzdan adresi getirme hatası:", error);
    return NextResponse.json(
      { error: "Cüzdan adresi getirilemedi" },
      { status: 500 }
    );
  }
}

// Cüzdan adresini kaydet/güncelle
export async function POST(request: NextRequest) {
  try {
    // Session kontrolü - artık query parametresi yerine session kullanıyoruz
    const session = await requireAuth(request);
    const userId = session.userId;

    const { walletAddress } = await request.json();

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Geçerli bir cüzdan adresi girin" },
        { status: 400 }
      );
    }

    // TRC20 cüzdan adresi validasyonu (T ile başlamalı ve 34 karakter olmalı)
    if (!walletAddress.startsWith("T") || walletAddress.length !== 34) {
      return NextResponse.json(
        { error: "Geçersiz TRC20 cüzdan adresi. T ile başlamalı ve 34 karakter olmalıdır." },
        { status: 400 }
      );
    }

    // ✅ Bu cüzdan adresi başka kullanıcıda kayıtlı mı kontrolü
    const existingWithSameWallet = await prisma.user.findFirst({
      where: {
        trc20WalletAddress: walletAddress,
        id: { not: userId } // Kendi kaydı hariç
      }
    });

    if (existingWithSameWallet) {
      return NextResponse.json(
        { error: "Bu cüzdan adresi başka bir üyede kayıtlı." },
        { status: 409 }
      );
    }

    // Önce mevcut adresi al (log için)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { trc20WalletAddress: true }
    });

    const oldAddress = existingUser?.trc20WalletAddress || null;
    const isUpdate = !!oldAddress;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { trc20WalletAddress: walletAddress },
    });

    // Cache invalidate - yeni veri yüklensin (TRC20 için cache bypass)
    invalidateCache.user(userId);
    enhancedCache.delete(CacheKeys.USER_STATS(userId));

    // Activity log
    const requestInfo = extractRequestInfo(request);
    await logWalletChange(
      userId,
      isUpdate ? 'wallet_update' : 'wallet_add',
      oldAddress,
      walletAddress,
      requestInfo
    );

    return NextResponse.json({
      success: true,
      walletAddress: user.trc20WalletAddress,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      );
    }
    console.error("Cüzdan adresi kaydetme hatası:", error);
    return NextResponse.json(
      { error: "Cüzdan adresi kaydedilemedi" },
      { status: 500 }
    );
  }
}

// Cüzdan adresini sil
export async function DELETE(request: NextRequest) {
  try {
    // Session kontrolü - artık query parametresi yerine session kullanıyoruz
    const session = await requireAuth(request);
    const userId = session.userId;

    // Önce mevcut adresi al (log için)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { trc20WalletAddress: true }
    });

    const oldAddress = existingUser?.trc20WalletAddress || null;

    await prisma.user.update({
      where: { id: userId },
      data: { trc20WalletAddress: null },
    });

    // Cache invalidate - yeni veri yüklensin (TRC20 için cache bypass)
    invalidateCache.user(userId);
    enhancedCache.delete(CacheKeys.USER_STATS(userId));

    // Activity log
    if (oldAddress) {
      const requestInfo = extractRequestInfo(request);
      await logWalletChange(
        userId,
        'wallet_delete',
        oldAddress,
        null,
        requestInfo
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' },
        { status: 401 }
      );
    }
    console.error("Cüzdan adresi silme hatası:", error);
    return NextResponse.json(
      { error: "Cüzdan adresi silinemedi" },
      { status: 500 }
    );
  }
}
