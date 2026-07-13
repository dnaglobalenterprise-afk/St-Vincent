import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Trophy } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { supabase } from '../../lib/supabase'
import type { BadgeAward, BadgeDef, Streak } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { BADGE_ICONS, levelFor, levelProgress, streakActiveToday } from './gamification'

export function GamificationCard() {
  const { profile } = useAuth()
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState<Streak | null>(null)
  const [badges, setBadges] = useState<{ def: BadgeDef; awarded: boolean }[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    Promise.all([
      supabase.rpc('user_points', { p_user_id: profile.id }),
      supabase.from('streaks').select('*').eq('user_id', profile.id).maybeSingle(),
      supabase.from('badges').select('*'),
      supabase.from('badge_awards').select('*').eq('user_id', profile.id),
    ]).then(([{ data: pts }, { data: st }, { data: defs }, { data: awards }]) => {
      if (cancelled) return
      setPoints(typeof pts === 'number' ? pts : 0)
      setStreak(st as Streak | null)
      const awardedSlugs = new Set((awards ?? []).map((a: BadgeAward) => a.badge_slug))
      setBadges((defs ?? []).map((d: BadgeDef) => ({ def: d, awarded: awardedSlugs.has(d.slug) })))
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [profile])

  if (!loaded) return null

  const lvl = levelFor(points)
  const prog = levelProgress(points)
  const activeToday = streakActiveToday(streak?.last_activity_date ?? null)
  const earned = badges.filter((b) => b.awarded).slice(-3)

  const R = 34
  const C = 2 * Math.PI * R

  return (
    <Card header="Your Progress">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {/* Level ring */}
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r={R} fill="none" stroke="#D6EBFA" strokeWidth="7" />
              <circle cx="40" cy="40" r={R} fill="none" stroke="#FCD116" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - prog.pct)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-heading text-lg font-bold text-ink">L{lvl.level}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-heading text-xl font-semibold text-ink">{lvl.name}</p>
            <p className="text-base text-ink-muted">{points} points</p>
            {prog.toNext !== null && <p className="text-sm text-ink-muted">{prog.toNext} to {prog.nextName}</p>}
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-2">
          <Flame className={`h-5 w-5 ${activeToday ? 'text-svggold-500' : 'text-ink-muted'}`} aria-hidden="true" />
          <span className="text-base text-ink">
            {streak?.current_streak ?? 0}-day streak
            {!activeToday && <span className="text-ink-muted"> · do one lesson today to keep it alive</span>}
          </span>
        </div>

        {/* Latest badges */}
        {earned.length > 0 && (
          <div className="flex items-center gap-2">
            {earned.map((b) => {
              const Icon = BADGE_ICONS[b.def.icon]
              return (
                <span key={b.def.slug} className="flex h-9 w-9 items-center justify-center rounded-full bg-svggold-100" title={b.def.name}>
                  {Icon && <Icon className="h-5 w-5 text-svggold-600" aria-hidden="true" />}
                </span>
              )
            })}
          </div>
        )}

        <Link to="/learn/leaderboard" className="flex items-center gap-1.5 text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
          <Trophy className="h-4 w-4" aria-hidden="true" /> View leaderboard →
        </Link>
      </div>
    </Card>
  )
}
