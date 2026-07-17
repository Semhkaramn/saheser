'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'

interface MatchUser {
  id: string
  siteUsername: string | null
  telegramId: string | null
  telegramUsername: string | null
  firstName: string | null
  points: number
  createdAt: string
}

interface MultiMatch {
  type: 'ip'
  value: string
  users: MatchUser[]
  count: number
}

interface Stats {
  totalDuplicateIPs: number
  usersWithMulti: number
}

export default function MultiDetectionPage() {
  const [matches, setMatches] = useState<MultiMatch[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/multi-detection?includeStats=true')
      const data = await res.json()
      setMatches(data.matches || [])
      setStats(data.stats || null)
    } catch {
      toast.error('Yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-page-container">
      <h1 className="font-display text-2xl font-extrabold mb-1 text-white">Multi Hesap Tespiti</h1>
      <p className="text-sm admin-text-muted mb-6">
        Aynı IP'den giriş yapan farklı hesaplar. Tek eşleşme kesin kanıt değildir, incelemeye değer.
      </p>

      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
          <div className="admin-card p-4 text-center">
            <p className="text-2xl font-black text-white">{stats.totalDuplicateIPs}</p>
            <p className="text-xs admin-text-muted mt-1">Tekrarlayan IP</p>
          </div>
          <div className="admin-card p-4 text-center">
            <p className="text-2xl font-black text-white">{stats.usersWithMulti}</p>
            <p className="text-xs admin-text-muted mt-1">Etkilenen Kullanıcı</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="admin-text-muted text-sm">Yükleniyor...</p>
      ) : matches.length === 0 ? (
        <div className="admin-card p-8 text-center">
          <p className="admin-text-muted text-sm">Herhangi bir tekrarlayan IP eşleşmesi bulunamadı.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {matches.map((m) => (
            <div key={m.value} className="admin-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-mono text-sm text-white">{m.value}</p>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400">
                  {m.count} hesap
                </span>
              </div>
              <div className="space-y-1.5">
                {m.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/admin/users/${u.id}`}
                    className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white">
                      {u.siteUsername || u.telegramUsername || u.firstName || u.id}
                      {u.telegramUsername && <span className="admin-text-muted ml-1.5">@{u.telegramUsername}</span>}
                    </span>
                    <span className="admin-text-muted font-data">
                      {u.points.toLocaleString('tr-TR')} puan · {new Date(u.createdAt).toLocaleDateString('tr-TR')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
