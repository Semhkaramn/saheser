import { AlertCircle } from 'lucide-react'
import React from 'react'

/**
 * Admin bir açıklama girerken metnin dikkat çekmesi gereken kısmını
 * <span>böyle</span> yazarsa, SADECE o kısım kırmızı/yuvarlak/ünlem
 * işaretli, yanıp sönen bir kutu içinde gösterilir - geri kalan metin düz
 * kalır. Hiç <span> yoksa tüm metin normal şekilde gösterilir.
 *
 * Kullanım: <HighlightedText text={sponsor.description} />
 */
export default function HighlightedText({ text, className = '', style }: { text: string; className?: string; style?: React.CSSProperties }) {
  if (!text) return null

  const parts = text.split(/(<span>[\s\S]*?<\/span>)/g)

  return (
    <span className={className} style={{ whiteSpace: 'pre-line', ...style }}>
      {parts.map((part, i) => {
        const match = part.match(/^<span>([\s\S]*?)<\/span>$/)
        if (match) {
          return (
            <span key={i} className="highlight-badge">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {match[1]}
            </span>
          )
        }
        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </span>
  )
}
