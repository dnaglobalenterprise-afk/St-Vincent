import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { BadgeAward, BadgeDef } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { BADGE_ICONS } from './gamification'

export function BadgesGrid() {
  const { profile } = useAuth()
  const [badges, setBadges] = useState<{ def: BadgeDef; awarded: boolean }[]>([])

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('badges').select('*'),
      supabase.from('badge_awards').select('*').eq('user_id', profile.id),
    ]).then(([{ data: defs }, { data: awards }]) => {
      const awarded = new Set((awards ?? []).map((a: BadgeAward) => a.badge_slug))
      setBadges((defs ?? []).map((d: BadgeDef) => ({ def: d, awarded: awarded.has(d.slug) })))
    })
  }, [profile])

  if (badges.length === 0) return null

  return (
    <section aria-label="Badges" className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold text-ink">Badges</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {badges.map(({ def, awarded }) => {
          const Icon = BADGE_ICONS[def.icon]
          return (
            <div
              key={def.slug}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center ${awarded ? 'border-svggold-500 bg-svggold-100' : 'border-line bg-surface-alt'}`}
            >
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-full ${awarded ? 'bg-svggold-500' : 'bg-white'}`}>
                {Icon && <Icon className={`h-6 w-6 ${awarded ? 'text-ink' : 'text-ink-muted'}`} aria-hidden="true" />}
                {!awarded && <Lock className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white p-0.5 text-ink-muted" aria-hidden="true" />}
              </span>
              <p className={`font-heading text-sm font-semibold ${awarded ? 'text-ink' : 'text-ink-muted'}`}>{def.name}</p>
              <p className="text-xs text-ink-muted">{def.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
