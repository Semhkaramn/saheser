import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Unbounded, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/auth-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { UserThemeProvider } from "@/components/providers/user-theme-provider";
import VisitTracker from "@/components/VisitTracker";
import LoginModal from '@/components/LoginModal';
import RegisterModal from '@/components/RegisterModal';
import FaviconLoader from '@/components/FaviconLoader';
import GlobalPreloader from '@/components/GlobalPreloader';
import TelegramModalWrapper from '@/components/TelegramModalWrapper';
import StructuredData from '@/components/StructuredData';
import { SITE_CONFIG } from '@/lib/site-config';

// Başlıklar / rozetler / puan sayaçları için karakterli, yuvarlak-geometrik
// bir görüntü fontu - "ödül/rozet toplama" hissini taşıyor
const displayFont = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

// Gövde metni için sıcak, okunaklı bir tamamlayıcı
const bodyFont = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

// Puan/bilet numarası/geri sayım gibi veriler için mono yardımcı font
const monoFont = JetBrains_Mono({
  variable: "--font-mono-data",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["monospace"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
};

export async function generateMetadata(): Promise<Metadata> {
  const siteName = SITE_CONFIG.siteName;
  const siteLogo = SITE_CONFIG.siteLogo || '/logo.webp';
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://harleycasino.com';
  const siteDescription = `${siteName} - Puan kazan, rütbe atla, ödüller kazan! Şans çarkı ve daha fazlası. Günlük görevler, etkinlikler ve çekilişlerle kazanma şansını yakala.`;

  return {
    title: {
      default: `${siteName} | Puan Kazan, Ödüller Kazan`,
      template: `%s | ${siteName}`
    },
    description: siteDescription,
    keywords: [
      siteName.toLowerCase(),
      "puan kazan",
      "rütbe sistemi",
      "ödül",
      "çekiliş",
      "etkinlik",
      "çark oyunu",
      "günlük görevler",
      "bonus",
      "promosyon"
    ],
    authors: [{ name: siteName }],
    creator: siteName,
    publisher: siteName,
    metadataBase: new URL(siteUrl),
    alternates: {
      canonical: siteUrl,
    },
    icons: {
      icon: { url: siteLogo, type: 'image/webp' },
      apple: { url: siteLogo, type: 'image/webp' },
      shortcut: { url: siteLogo, type: 'image/webp' },
    },
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    // ⚠️ Bilerek openGraph/twitter meta verisi YOK: link paylaşılınca
    // (Telegram/WhatsApp vb.) hiçbir önizleme kartı (görsel, başlık,
    // açıklama - hiçbiri) görünmesin isteniyor.
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      // Google Search Console doğrulama kodu buraya eklenecek
      // google: 'your-google-verification-code',
    },
    category: 'entertainment',
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Preconnect - Kritik kaynaklar için erken bağlantı */}
        <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />



        {/* Kritik CSS - Render blocking'i azalt */}
        <style dangerouslySetInnerHTML={{__html: `
          *{box-sizing:border-box;margin:0;padding:0}
          html,body{overflow-x:hidden;max-width:100vw}
          body{font-family:var(--font-body),system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#0B1120;color:#F1F5F9;line-height:1.5;-webkit-font-smoothing:antialiased}
          .preloader{position:fixed;inset:0;background:linear-gradient(135deg,#0B1120,#111A2E,#0B1120);z-index:9999;display:flex;align-items:center;justify-content:center}
          img,picture,video,canvas,svg{display:block;max-width:100%;height:auto}
          header{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(11,17,32,.9);backdrop-filter:blur(12px);border-bottom:1px solid rgba(59,130,246,.15);height:4rem}
          @media(min-width:1024px){header{height:5rem}}

        `}} />
      </head>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased bg-gradient-to-br from-[#0B1120] via-[#111A2E] to-[#0B1120] min-h-screen text-[#F1F5F9] overflow-x-hidden max-w-screen`}
        suppressHydrationWarning
      >
        {/* Google Analytics (gtag.js) - next/script ile, sayfa yüklenmesini
            engellemeyecek şekilde (strategy="afterInteractive") ekleniyor.
            Raw <script> tag'i yerine bu şekilde eklemek Next.js'in önerdiği
            yöntem - sayfa hızını etkilemiyor. */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-EBPHRH4R76" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-EBPHRH4R76');
          `}
        </Script>
        <GlobalPreloader />
        <StructuredData />
        <QueryProvider>
          <AuthProvider>
            <UserThemeProvider>
              <FaviconLoader />
              <VisitTracker />
              {children}
              <LoginModal />
              <RegisterModal />
              <TelegramModalWrapper />
              <Toaster />
            </UserThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
