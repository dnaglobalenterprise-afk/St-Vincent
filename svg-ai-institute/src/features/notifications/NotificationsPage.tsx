import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellOff, Check } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import type { Notification } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { loadNotifications, markAllRead, markRead, notifIcon, notifTime } from './notifications'

export function NotificationsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (!profile) return
    setItems(await loadNotifications(profile.id))
    setLoaded(true)
  }, [profile])

  useEffect(() => { void load() }, [load])

  const open = async (n: Notification) => {
    if (!n.read_at) { await markRead(n.id); setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))) }
    if (n.link) navigate(n.link)
  }

  const clearAll = async () => {
    if (!profile) return
    await markAllRead(profile.id)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Everything the platform wanted to tell you."
        action={items.some((n) => !n.read_at) ? <Button variant="secondary" size="sm" onClick={() => void clearAll()}><Check className="h-4 w-4" /> Mark all read</Button> : undefined}
      />
      {!loaded ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={BellOff} message="All caught up." /></Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
          {items.map((n) => {
            const Icon = notifIcon(n.type)
            return (
              <button key={n.id} type="button" onClick={() => void open(n)}
                className={`flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left last:border-0 hover:bg-svgblue-50 ${n.read_at ? '' : 'bg-svgblue-50'}`}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-svgblue-100"><Icon className="h-4.5 w-4.5 text-svgblue-500" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-ink">{n.title}</span>
                  {n.body && <span className="block text-sm text-ink-muted">{n.body}</span>}
                  <span className="block text-xs text-ink-muted">{notifTime(n.created_at)}</span>
                </span>
                {!n.read_at && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-svgblue-500" aria-label="unread" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
