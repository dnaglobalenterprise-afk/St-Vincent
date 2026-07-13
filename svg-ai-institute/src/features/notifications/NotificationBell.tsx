import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Notification } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { loadNotifications, markAllRead, markRead, notifIcon, notifTime, unreadCount } from './notifications'

export function NotificationBell() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [pulse, setPulse] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(async () => {
    if (profile) setCount(await unreadCount(profile.id))
  }, [profile])

  useEffect(() => {
    if (!profile) return
    void refreshCount()
    // Unique channel name per effect run — a stable name collides with the still
    // -subscribed channel under StrictMode's double-mount ("add callbacks after subscribe").
    const sub = supabase
      .channel(`notif-${profile.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
        void refreshCount()
        setPulse(true)
        setTimeout(() => setPulse(false), 600)
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [profile, refreshCount])

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const toggle = async () => {
    const next = !open
    setOpen(next)
    if (next && profile) setItems(await loadNotifications(profile.id, 8))
  }

  const openItem = async (n: Notification) => {
    if (!n.read_at) { await markRead(n.id); void refreshCount() }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const clearAll = async () => {
    if (!profile) return
    await markAllRead(profile.id)
    setCount(0)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={`Notifications${count ? ` (${count} unread)` : ''}`} onClick={() => void toggle()}
        className={`relative rounded-xl p-2 text-ink-muted hover:bg-svgblue-50 hover:text-svgblue-500 ${pulse ? 'animate-pulse' : ''}`}>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-svgblue-500 px-1 text-xs font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-30 flex w-80 max-w-[90vw] flex-col rounded-xl border border-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <p className="font-heading text-sm font-semibold text-ink">Notifications</p>
            <button type="button" onClick={() => void clearAll()} className="flex items-center gap-1 text-xs font-medium text-svgblue-500 hover:text-svgblue-700">
              <Check className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">All caught up.</p>
            ) : (
              items.map((n) => {
                const Icon = notifIcon(n.type)
                return (
                  <button key={n.id} type="button" onClick={() => void openItem(n)}
                    className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-svgblue-50 ${n.read_at ? '' : 'bg-svgblue-50'}`}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-svgblue-100"><Icon className="h-4 w-4 text-svgblue-500" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{n.title}</span>
                      {n.body && <span className="block truncate text-sm text-ink-muted">{n.body}</span>}
                      <span className="block text-xs text-ink-muted">{notifTime(n.created_at)}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
          <button type="button" onClick={() => { setOpen(false); navigate('/notifications') }} className="border-t border-line px-4 py-2.5 text-center text-sm font-medium text-svgblue-500 hover:bg-svgblue-50">
            See all
          </button>
        </div>
      )}
    </div>
  )
}
