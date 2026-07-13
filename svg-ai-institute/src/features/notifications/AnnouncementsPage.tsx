import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Announcement, Cohort, Room } from '../../lib/types'

export function AnnouncementsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [roomId, setRoomId] = useState('')
  const [cohortId, setCohortId] = useState('') // '' = whole room
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [history, setHistory] = useState<Announcement[]>([])
  const [loaded, setLoaded] = useState(false)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setHistory(data ?? [])
    setLoaded(true)
  }, [])

  useEffect(() => {
    supabase.from('rooms').select('*').eq('status', 'active').order('name').then(({ data }) => {
      setRooms(data ?? [])
      if (data?.[0]) setRoomId(data[0].id)
    })
    void loadHistory()
  }, [loadHistory])

  useEffect(() => {
    if (!roomId) return
    supabase.from('cohorts').select('*').eq('room_id', roomId).order('start_date', { ascending: false }).then(({ data }) => setCohorts(data ?? []))
    setCohortId('')
  }, [roomId])

  const send = async () => {
    setError(null)
    if (title.trim().length < 3) return setError('Title needs at least 3 characters.')
    if (body.trim().length < 10) return setError('Body needs at least 10 characters.')
    const audience = cohortId ? cohorts.find((c) => c.id === cohortId)?.name : 'the whole room'
    if (!confirm(`Send "${title.trim()}" to ${audience}? This notifies every active member.`)) return
    setSending(true)
    const { data, error: err } = await supabase.rpc('send_announcement', {
      p_room_id: roomId,
      p_cohort_id: cohortId || null,
      p_title: title.trim(),
      p_body: body.trim(),
    })
    setSending(false)
    if (err) return setError(err.message === 'forbidden' ? 'Only staff can send announcements.' : err.message)
    setToast(`Sent to ${data} ${data === 1 ? 'person' : 'people'}.`)
    setTitle('')
    setBody('')
    setTimeout(() => setToast(null), 4000)
    void loadHistory()
  }

  const cohortName = (id: string | null) => (id ? cohorts.find((c) => c.id === id)?.name ?? 'a cohort' : 'Whole room')

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Announcements" description="Send a message to a cohort or the whole room — in-app and by email." />

      {toast && <div className="rounded-xl bg-svggreen-100 px-4 py-3 text-base font-medium text-svggreen-700">{toast}</div>}

      <Card header="Compose">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Room</span>
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-base text-ink">
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Audience</span>
              <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-base text-ink">
                <option value="">Whole room</option>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <Input label="Title" name="ann-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">Body (markdown)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
              className="rounded-xl border border-line bg-white px-3 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500" />
          </label>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button loading={sending} onClick={() => void send()} className="self-start"><Send className="h-4 w-4" aria-hidden="true" /> Send announcement</Button>
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold text-ink">History</h2>
        {!loaded ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : history.length === 0 ? (
          <Card><EmptyState icon={Megaphone} message="No announcements sent yet." /></Card>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-base font-semibold text-ink">{a.title}</p>
                    <p className="truncate text-sm text-ink-muted">{a.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">{cohortName(a.cohort_id)} · {a.sent_count} recipients · {new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
