'use client'

import { useState } from 'react'
import { useUserTheme } from '@/components/providers/user-theme-provider'
import PageHeader from '@/components/PageHeader'
import {
  BookOpen,
  MessageCircle,
  Ticket,
  FileText,
  ShoppingBag,
  Calendar,
  TicketCheck,
  Gift,
  Sparkles,
  Trophy,
  Repeat,
  ChevronDown,
  Dice5,
} from 'lucide-react'

interface Section {
  icon: React.ElementType
  title: string
  summary: string
  steps: string[]
}

const sections: Section[] = [
  {
    icon: MessageCircle,
    title: 'Puan ve XP Nasıl Kazanılır?',
    summary: 'Telegram grubumuzda yazdığın her mesaj seni ödüllendirir.',
    steps: [
      'Resmi Telegram grubumuzda mesaj yazdıkça otomatik olarak puan ve XP kazanırsın.',
      'Çok kısa mesajlar (tek harf, tek emoji gibi) sayılmayabilir - normal, anlamlı mesajlar yaz.',
      'Art arda çok hızlı mesaj atmak puan kazandırmaz - mesajlar arasında kısa bir bekleme süresi var.',
      'Kazandığın XP arttıkça rütben yükselir, kazandığın puanı Mağaza\'da harcayabilirsin.',
      'Profilinden toplam puanını, rütbeni ve bir sonraki rütbeye ne kadar kaldığını görebilirsin.',
    ],
  },
  {
    icon: Dice5,
    title: 'Şans Çarkı',
    summary: 'Her gün ücretsiz çevirme hakkın var, puan ve ödül kazanabilirsin.',
    steps: [
      'Menüden "Çark" sayfasına gir.',
      'Her gün belirli sayıda ücretsiz çevirme hakkın otomatik yenilenir.',
      'Çarkı çevir, çıkan ödül (puan ya da başka bir ödül) otomatik hesabına eklenir.',
      'Çevirme hakların bittiğinde bir sonraki yenilenme zamanını sayfada görebilirsin.',
    ],
  },
  {
    icon: FileText,
    title: 'Görevler',
    summary: 'Basit görevleri tamamlayıp ekstra puan kazan.',
    steps: [
      'Menüden "Görevler" sayfasına gir.',
      'Listede aktif görevleri ve her birinin ödülünü görürsün.',
      'Bir görevi tamamladığında (koşullarını sağladığında) ödülünü sayfadan alabilirsin.',
      'Tamamlanan görevler işaretlenir, tekrar aynı ödülü veremezler (görev tipine göre günlük/haftalık yenilenebilir).',
    ],
  },
  {
    icon: ShoppingBag,
    title: 'Mağaza',
    summary: 'Biriktirdiğin puanı gerçek ürün ve avantajlarla değiştir.',
    steps: [
      'Menüden "Mağaza" sayfasına gir, ürünleri incele.',
      'Bazı ürünleri satın alabilmek için önce ilgili sponsora "Aff Geçiş" yapman (aşağıda anlatılıyor) ve onaylanman gerekir - onaylanmadıysan "Satın Al" sırasında bu sana bildirilir.',
      '"Satın Al" dediğinde puanın düşer, siparişin admin onayına gider.',
      'Sipariş onaylanınca/reddedilince Telegram\'dan özelden bilgilendirilirsin.',
      '"Geçmiş Siparişlerim" sekmesinden tüm alışverişlerini görebilirsin.',
    ],
  },
  {
    icon: Calendar,
    title: 'Etkinlikler',
    summary: 'Sponsorlu etkinliklere katılıp ödül kazanma şansı yakala.',
    steps: [
      'Menüden "Etkinlikler" sayfasına gir, aktif etkinlikleri gör.',
      'Bir etkinlik "İlk Gelen" tipindeyse belirli bir kontenjan doldukça kapanır; "Çekiliş" tipindeyse süre sonunda kazananlar rastgele seçilir; "Herkes Kazanır" tipindeyse katılan herkes kazanır.',
      'Bazı etkinlikler için önce ilgili sponsora "Aff Geçiş" yapıp onaylanman istenebilir.',
      '"Katıl" butonuna bastığında katılımın kaydedilir, sonucu etkinlik detay sayfasından takip edebilirsin.',
    ],
  },
  {
    icon: TicketCheck,
    title: 'Biletler (Bilet Çekilişleri)',
    summary: 'Yatırım/bilet tabanlı çekilişlere katıl, numaranı öğren.',
    steps: [
      'Menüden "Biletler" sayfasına gir, aktif bilet etkinliklerini gör.',
      'Bir bilet etkinliğine katılmak için gerekiyorsa önce ilgili sponsora "Aff Geçiş" yap.',
      '"Katıl" dedikten sonra admin, yatırım tutarına göre sana bilet numarası/numaraları atar.',
      'Etkinlik süresi dolunca (ya da bilet biterse) çekiliş yapılır, kazananlar duyurulur.',
      'Kendi bilet numaralarını ve geçmiş katılımlarını sayfadan takip edebilirsin.',
    ],
  },
  {
    icon: Gift,
    title: 'Deneme Bonusları ve Promosyonlar',
    summary: 'Sponsor sitelerin güncel bonus ve kampanyalarını tek yerden gör.',
    steps: [
      'Menüden "Deneme Bonusları" ya da "Promosyonlar" sayfasına gir.',
      'Her kart bir sponsora ait güncel bir teklifi gösterir - detayına girip koşullarını okuyabilirsin.',
      '"Siteye Git" ile doğrudan ilgili sponsorun sitesine yönlendirilirsin.',
    ],
  },
  {
    icon: Sparkles,
    title: 'Randy ve Klasik Çekilişler (Telegram Grubunda)',
    summary: 'Grup içinde botun açtığı anlık çekilişlere katıl.',
    steps: [
      'Randy: Bot grup içinde bir çekiliş mesajı paylaşır, "Katıl" butonuna basarak (bazen bir şart varsa onu sağlayarak) katılırsın. Süre dolunca ya da yeterli katılımcı olunca kazananlar seçilir.',
      'Klasik Çekiliş: Bot rastgele bir anda devreye girer, o anda belirli bir mesajı ilk yazan kişi kazanır - bunun için özel bir şey yapmana gerek yok, grupta aktif olman yeterli.',
      'Her iki çekilişin kazananları da grupta duyurulur, ödülün (varsa) nasıl alınacağı bot tarafından özelden sana bildirilir.',
    ],
  },
  {
    icon: Repeat,
    title: 'Aff Geçiş (Sponsor Bilgisi)',
    summary: 'Bazı ödülleri/etkinlikleri kullanabilmek için sponsor hesabını doğrulaman gerekir.',
    steps: [
      'Menüden "Aff Geçiş" sayfasına gir.',
      'İlgili sponsoru seç ve o sponsordaki kullanıcı adını/ID\'ni/e-postanı (sponsora göre değişir) gir.',
      'Bilgin admin tarafından incelenir, onaylanır ya da reddedilir - durumunu bu sayfadan her zaman görebilirsin.',
      'Onaylandıktan sonra o sponsora bağlı market ürünlerine, etkinliklere ve biletlere katılabilirsin.',
    ],
  },
  {
    icon: Trophy,
    title: 'Liderlik Tablosu ve Rütbeler',
    summary: 'En aktif üyeler arasında nerede olduğunu gör.',
    steps: [
      'Menüden "Liderlik" sayfasına gir.',
      'Puana göre ve XP\'ye (aktifliğe) göre ayrı sıralamalar görebilirsin.',
      'XP arttıkça rütbenin nasıl yükseldiğini profilinden takip edebilirsin - her rütbenin kendi ikonu ve rengi vardır.',
    ],
  },
]

function SectionCard({ section }: { section: Section }) {
  const { theme } = useUserTheme()
  const [open, setOpen] = useState(false)
  const Icon = section.icon

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ background: theme.colors.card, border: `1px solid ${theme.colors.cardBorder}` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${theme.colors.primary}18` }}
        >
          <Icon className="w-5 h-5" style={{ color: theme.colors.primary }} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-sm sm:text-base" style={{ color: theme.colors.text }}>
            {section.title}
          </h3>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: theme.colors.textMuted }}>
            {section.summary}
          </p>
        </div>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0 transition-transform duration-200"
          style={{ color: theme.colors.textMuted, transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="pl-[52px] space-y-2">
            {section.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${theme.colors.primary}15`, color: theme.colors.primary }}
                >
                  {i + 1}
                </span>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: theme.colors.textSecondary }}>
                  {step}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RehberPage() {
  const { theme } = useUserTheme()

  return (
    <div className="user-page-container">
      <div className="user-page-inner space-y-4 max-w-2xl mx-auto">
        <PageHeader icon={BookOpen} title="Rehber" subtitle="Sitede her şey nasıl çalışır? Merak ettiğin başlığa tıkla." />

        <div className="space-y-3">
          {sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>

        <p className="text-xs text-center pt-2" style={{ color: theme.colors.textMuted }}>
          Başka bir sorunun olursa Telegram grubumuzdan bize ulaşabilirsin.
        </p>
      </div>
    </div>
  )
}
