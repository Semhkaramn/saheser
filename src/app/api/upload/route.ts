import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// 🚀 OPTIMIZED: Cloudinary config from ENV (no DB query)
function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary ayarları yapılmamış. Lütfen ENV variables ayarlayın.')
  }

  return {
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  }
}

// Cloudinary folder name
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_UPLOAD_PRESET || 'uploads'

export async function POST(request: NextRequest) {
  try {
    // Cloudinary ayarlarını al
    const config = getCloudinaryConfig()

    // Cloudinary'yi yapılandır
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || CLOUDINARY_FOLDER;

    if (!file) {
      return NextResponse.json(
        { error: 'Dosya bulunamadı' },
        { status: 400 }
      );
    }

    // İzin verilen dosya türleri
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/svg+xml',
      'image/webp',
      'video/webm'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Desteklenmeyen dosya türü: ${file.type}. İzin verilen türler: PNG, JPG, GIF, SVG, WebP, WebM` },
        { status: 400 }
      );
    }

    // Dosya boyutu kontrolü (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Dosya boyutu 5MB\'dan küçük olmalıdır' },
        { status: 400 }
      );
    }

    // Dosyayı buffer'a çevir
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Base64'e çevir
    const base64File = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Cloudinary'e yükle - SVG ve video için doğru resource_type belirleme
    let resourceType: 'image' | 'video' | 'auto' = 'auto';
    if (file.type === 'video/webm') {
      resourceType = 'video';
    } else if (file.type.startsWith('image/')) {
      resourceType = 'image';
    }

    // 🚀 OPTIMIZATION: PNG/JPEG/GIF yüklemeleri genelde 2-3MB'a kadar çıkabiliyordu
    // (özellikle telefon kamerası/ekran görüntüsü). Bunları otomatik olarak
    // WebP'ye çevirip sıkıştırıyoruz - dosya boyutu ciddi oranda düşüyor,
    // görsel kalitesi gözle fark edilmeyecek şekilde korunuyor. GIF de dahil -
    // WebP animasyonu destekliyor, GIF'ten çok daha küçük boyutta aynı
    // animasyonu verebiliyor. Sadece SVG'ye dokunmuyoruz (vektör, rasterize
    // olup kalite/ölçeklenebilirlik kaybederdi).
    const isConvertibleRasterImage = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'].includes(file.type)
    const isVideo = file.type === 'video/webm'

    const uploadOptions: Record<string, unknown> = {
      folder: folder,
      resource_type: resourceType,
    }

    if (isConvertibleRasterImage) {
      uploadOptions.format = 'webp'
      uploadOptions.quality = 'auto:good'
      uploadOptions.transformation = [
        { width: 2000, height: 2000, crop: 'limit' }, // Aşırı büyük orijinalleri sınırla, küçükleri büyütme
      ]
    } else if (isVideo) {
      // Video yüklemeleri de sıkıştırılmadan olduğu gibi saklanıyordu -
      // otomatik kalite optimizasyonu + aşırı büyük çözünürlükleri sınırla.
      uploadOptions.quality = 'auto:good'
      uploadOptions.transformation = [
        { width: 1280, height: 1280, crop: 'limit' },
      ]
    }

    const result = await cloudinary.uploader.upload(base64File, uploadOptions);

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error: any) {
    console.error('Upload hatası:', error);
    return NextResponse.json(
      { error: error?.message || 'Resim yüklenirken hata oluştu' },
      { status: 500 }
    );
  }
}

// Cloudinary'den resim silme
export async function DELETE(request: NextRequest) {
  try {
    // 🚀 OPTIMIZED: Cloudinary config from ENV
    const config = getCloudinaryConfig()

    // Cloudinary'yi yapılandır
    cloudinary.config({
      cloud_name: config.cloud_name,
      api_key: config.api_key,
      api_secret: config.api_secret,
    });

    const { publicId } = await request.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'Public ID bulunamadı' },
        { status: 400 }
      );
    }

    await cloudinary.uploader.destroy(publicId);

    return NextResponse.json({
      success: true,
      message: 'Resim silindi',
    });
  } catch (error: any) {
    console.error('Silme hatası:', error);
    return NextResponse.json(
      { error: error?.message || 'Resim silinirken hata oluştu' },
      { status: 500 }
    );
  }
}
