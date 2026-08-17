'use client'

import { useMemo } from 'react'

// Gerçek Avrupa rulet çarkının standart sayı dizilimi (tek sıfır, saat yönünde)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
]
const SECTOR_COUNT = WHEEL_ORDER.length
const SECTOR_ANGLE = 360 / SECTOR_COUNT

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

function pocketColor(n: number): string {
  if (n === 0) return '#0f7a3d'
  return RED_NUMBERS.has(n) ? '#b91c1c' : '#18181b'
}

/** Bir sayının çark üzerindeki merkez açısını döndürür (0deg = üst / saat 12, saat yönünde artar) */
export function angleForNumber(n: number): number {
  const idx = WHEEL_ORDER.indexOf(n)
  return idx >= 0 ? idx * SECTOR_ANGLE : 0
}

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function sectorPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number): string {
  const [x1, y1] = polar(cx, cy, rOuter, startAngle)
  const [x2, y2] = polar(cx, cy, rOuter, endAngle)
  const [x3, y3] = polar(cx, cy, rInner, endAngle)
  const [x4, y4] = polar(cx, cy, rInner, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`
}

interface RouletteWheelProps {
  spinning: boolean
  ballRotation: number
  winningNumber: number | null
  size?: number
}

export default function RouletteWheel({ spinning, ballRotation, winningNumber, size = 260 }: RouletteWheelProps) {
  const cx = 110
  const cy = 110
  const rOuter = 104
  const rInner = 68
  const rNumberText = 86
  const rBallTrack = 96

  const sectors = useMemo(
    () =>
      WHEEL_ORDER.map((num, i) => {
        const start = i * SECTOR_ANGLE
        const end = start + SECTOR_ANGLE
        const mid = start + SECTOR_ANGLE / 2
        const [tx, ty] = polar(cx, cy, rNumberText, mid)
        return { num, start, end, mid, tx, ty }
      }),
    []
  )

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Dış ahşap kasa efekti */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 30%, #9a6a3a, #5c3a1e 70%, #3d2712)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 2px 6px rgba(255,255,255,0.15)',
        }}
      />

      {/* Dekoratif dönen dış bilezik (sadece görsel - sayılarla bağımsız, çevirirken yavaşça döner) */}
      <div
        className="absolute inset-[6px] rounded-full"
        style={{
          background: 'repeating-conic-gradient(from 0deg, #d4af37 0deg 4deg, #8a6a1f 4deg 8deg)',
          animation: spinning ? 'roulette-rim-spin 3s linear infinite' : undefined,
        }}
      />

      {/* Sayı halkası (SVG) - sabit, ball bunun etrafında döner */}
      <svg viewBox="0 0 220 220" className="absolute inset-[14px]" style={{ width: 'calc(100% - 28px)', height: 'calc(100% - 28px)' }}>
        <defs>
          <radialGradient id="hubGradient" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#3f3f46" />
            <stop offset="100%" stopColor="#09090b" />
          </radialGradient>
        </defs>

        {sectors.map((s) => (
          <g key={s.num}>
            <path d={sectorPath(cx, cy, rOuter, rInner, s.start, s.end)} fill={pocketColor(s.num)} stroke="#d4af37" strokeWidth={0.6} />
            <text
              x={s.tx}
              y={s.ty}
              fill="#fff"
              fontSize={s.num === winningNumber && !spinning ? 11 : 9}
              fontWeight={800}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${s.mid}, ${s.tx}, ${s.ty})`}
              style={{ transition: 'font-size 0.2s' }}
            >
              {s.num}
            </text>
          </g>
        ))}

        {/* Merkez göbek */}
        <circle cx={cx} cy={cy} r={rInner - 2} fill="url(#hubGradient)" stroke="#d4af37" strokeWidth={1.5} />
        {/* Göbek üzerindeki ışın çizgileri */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * 360) / 8
          const [x1, y1] = polar(cx, cy, 18, a)
          const [x2, y2] = polar(cx, cy, rInner - 6, a)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(212,175,55,0.35)" strokeWidth={1} />
        })}
      </svg>

      {/* Top (ball) - ayrı bir dönen kapsayıcı içinde, sabit yarıçapta, saat 12 konumundan başlar */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `rotate(${ballRotation}deg)`,
          transition: spinning ? 'transform 4.2s cubic-bezier(0.12, 0.75, 0.28, 1)' : 'none',
        }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 9,
            height: 9,
            top: `calc(50% - ${(rBallTrack / 110) * (size / 2)}px)`,
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle at 35% 30%, #fff, #cbd5e1 60%, #64748b)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        />
      </div>

      {/* Merkez sonuç göstergesi */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-black text-base border-2"
          style={{
            backgroundColor: winningNumber !== null ? pocketColor(winningNumber) : '#18181b',
            borderColor: '#d4af37',
            color: '#fff',
          }}
        >
          {winningNumber !== null && !spinning ? winningNumber : ''}
        </div>
      </div>

      <style>{`
        @keyframes roulette-rim-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  )
}
