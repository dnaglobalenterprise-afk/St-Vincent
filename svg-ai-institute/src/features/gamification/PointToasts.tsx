import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { PointEvent } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { KIND_META, kindLabel, levelFor } from './gamification'

interface ToastItem { id: string; points: number; kind: string }

/**
 * Global point-toast + level-up listener. Subscribes to the signed-in user's
 * own point_events inserts via Realtime and pops gold toasts; detects level-up
 * by comparing running totals and fires a full-screen gold celebration.
 */
export function PointToasts() {
  const { profile } = useAuth()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [levelUp, setLevelUp] = useState<string | null>(null)
  const totalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    // seed the running total so we can detect crossings
    supabase.rpc('user_points', { p_user_id: profile.id }).then(({ data }) => {
      if (!cancelled) totalRef.current = typeof data === 'number' ? data : 0
    })

    const sub = supabase
      .channel(`points-${profile.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'point_events', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const ev = payload.new as PointEvent
          const tid = ev.id
          setToasts((prev) => [...prev, { id: tid, points: ev.points, kind: ev.kind }])
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== tid)), 4000)
          // level-up detection
          if (totalRef.current !== null) {
            const before = totalRef.current
            const after = before + ev.points
            totalRef.current = after
            const lb = levelFor(before)
            const la = levelFor(after)
            if (la.level > lb.level) {
              setLevelUp(la.name)
              setTimeout(() => setLevelUp(null), 5000)
            }
          }
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(sub)
    }
  }, [profile])

  return (
    <>
      {/* Point toasts, bottom center */}
      <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 md:bottom-6">
        {toasts.map((t) => {
          const Icon = KIND_META[t.kind]?.icon
          return (
            <div key={t.id} className="flex items-center gap-2 rounded-full bg-svggold-500 px-4 py-2 text-base font-semibold text-ink shadow-card">
              {Icon && <Icon className="h-5 w-5" aria-hidden="true" />}
              +{t.points} — {kindLabel(t.kind)}
            </div>
          )
        })}
      </div>

      {/* Level-up full-screen celebration */}
      {levelUp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-svggold-500/20 backdrop-blur-sm" onClick={() => setLevelUp(null)}>
          <Confetti />
          <div className="rounded-xl bg-white px-10 py-8 text-center shadow-card">
            <p className="text-sm font-semibold uppercase tracking-widest text-svggold-600">Level up!</p>
            <p className="mt-2 font-heading text-4xl font-bold text-ink">{levelUp}</p>
          </div>
        </div>
      )}
    </>
  )
}

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => {
        // deterministic spread (no Math.random per render tick concerns here — decorative)
        const left = (i * 37) % 100
        const delay = (i % 10) * 0.15
        const color = ['bg-svggold-500', 'bg-svgblue-500', 'bg-svggreen-500'][i % 3]
        return (
          <span
            key={i}
            className={`absolute top-0 h-2 w-2 rounded-sm ${color}`}
            style={{ left: `${left}%`, animation: `confetti-fall 2.2s ${delay}s ease-in forwards` }}
          />
        )
      })}
      <style>{`@keyframes confetti-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1 } 100% { transform: translateY(110vh) rotate(540deg); opacity: 0 } }`}</style>
    </div>
  )
}
