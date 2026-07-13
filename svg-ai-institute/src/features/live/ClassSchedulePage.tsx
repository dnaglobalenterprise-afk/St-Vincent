import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, ExternalLink, Video } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { LiveClass } from '../../lib/types'
import { useAuth } from '../auth/useAuth'
import { ClassStatusBadge } from './ClassStatusBadge'
import { loadStudentClasses } from './classdata'
import { countdown, downloadIcs, formatAst, joinOpen } from './classtime'

export function ClassSchedulePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState<LiveClass[]>([])
  const [hosts, setHosts] = useState<Record<string, string>>({})
  const [recordingByClass, setRecordingByClass] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => 0)

  useEffect(() => {
    // seed now() after mount to avoid SSR/date issues, then tick each 30s
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    loadStudentClasses().then(async (cls) => {
      if (cancelled) return
      setClasses(cls)
      const hostIds = [...new Set(cls.map((c) => c.host_id))]
      const classIds = cls.map((c) => c.id)
      const [{ data: profiles }, { data: recs }] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, email').in('id', hostIds.length ? hostIds : ['x']),
        supabase.from('recordings').select('id, class_id, status').in('class_id', classIds.length ? classIds : ['x']).eq('status', 'ready'),
      ])
      const hostMap: Record<string, string> = {}
      for (const p of profiles ?? []) hostMap[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
      setHosts(hostMap)
      const recMap: Record<string, string> = {}
      for (const r of recs ?? []) if (r.class_id) recMap[r.class_id] = r.id
      setRecordingByClass(recMap)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [profile])

  const { upcoming, past, cancelled } = useMemo(() => {
    const nowT = now || Date.now()
    const up: LiveClass[] = []
    const pa: LiveClass[] = []
    const ca: LiveClass[] = []
    for (const c of classes) {
      if (c.status === 'cancelled') ca.push(c)
      else {
        const end = new Date(c.scheduled_at).getTime() + c.duration_minutes * 60_000
        if (end < nowT || c.status === 'ended') pa.push(c)
        else up.push(c)
      }
    }
    return { upcoming: up, past: pa.reverse(), cancelled: ca }
  }, [classes, now])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const nextClass = upcoming[0]

  const join = (c: LiveClass) => {
    if (c.mode === 'external' && c.meeting_url) {
      window.open(c.meeting_url, '_blank', 'noopener,noreferrer')
      void supabase.rpc('record_attendance', { p_class_id: c.id })
    } else {
      navigate(`/learn/classes/${c.id}`)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Live Classes" description="Join live, or catch the replay. All times in AST." />

      {classes.length === 0 && (
        <Card>
          <EmptyState icon={Video} message="No classes scheduled yet." />
        </Card>
      )}

      {/* Next class hero */}
      {nextClass && (
        <Card className="border-svgblue-500 bg-svgblue-50">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ClassStatusBadge status={nextClass.status} />
              <span className="text-sm font-medium text-svgblue-500">
                {countdown(nextClass.scheduled_at, nextClass.duration_minutes, now || Date.now()).label}
              </span>
            </div>
            <h2 className="font-heading text-2xl font-semibold text-ink">{nextClass.title}</h2>
            <p className="text-base text-ink">
              {formatAst(nextClass.scheduled_at)} · Host {hosts[nextClass.host_id] ?? ''}
            </p>
            {nextClass.description && <p className="text-base text-ink-muted">{nextClass.description}</p>}
            <div className="flex flex-wrap gap-3">
              {joinOpen(nextClass.scheduled_at, nextClass.duration_minutes, now || Date.now()) ? (
                <Button onClick={() => join(nextClass)}>
                  {nextClass.mode === 'external' ? (
                    <>
                      <ExternalLink className="h-4 w-4" aria-hidden="true" /> Join class
                    </>
                  ) : (
                    <>
                      <Video className="h-4 w-4" aria-hidden="true" /> Watch live
                    </>
                  )}
                </Button>
              ) : (
                <Button disabled title="Opens 15 minutes before class">
                  Opens 15 minutes before class
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() =>
                  downloadIcs({
                    id: nextClass.id,
                    title: nextClass.title,
                    description: nextClass.description,
                    scheduled_at: nextClass.scheduled_at,
                    duration_minutes: nextClass.duration_minutes,
                    meeting_url: nextClass.meeting_url,
                  })
                }
              >
                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Upcoming list */}
      {upcoming.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Upcoming</h2>
          {upcoming.slice(1).map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-base font-semibold text-ink">{c.title}</p>
                  <p className="text-sm text-ink-muted">
                    {formatAst(c.scheduled_at)} · {hosts[c.host_id] ?? ''}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    downloadIcs({
                      id: c.id,
                      title: c.title,
                      description: c.description,
                      scheduled_at: c.scheduled_at,
                      duration_minutes: c.duration_minutes,
                      meeting_url: c.meeting_url,
                    })
                  }
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Calendar
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {/* Past classes */}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Past classes</h2>
          {past.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-heading text-base font-semibold text-ink">{c.title}</p>
                  <p className="text-sm text-ink-muted">{formatAst(c.scheduled_at)}</p>
                </div>
                {recordingByClass[c.id] ? (
                  <Link to={`/learn/replays/${recordingByClass[c.id]}`}>
                    <Button variant="success" size="sm">
                      Watch replay
                    </Button>
                  </Link>
                ) : (
                  <Badge variant="neutral">No recording</Badge>
                )}
              </div>
            </Card>
          ))}
        </section>
      )}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold text-ink">Cancelled</h2>
          {cancelled.map((c) => (
            <Card key={c.id} className="opacity-70">
              <p className="font-heading text-base font-semibold text-ink line-through">{c.title}</p>
              <p className="text-sm text-ink-muted">{formatAst(c.scheduled_at)}</p>
              {c.cancel_reason && <p className="mt-1 text-sm text-warning">Cancelled: {c.cancel_reason}</p>}
            </Card>
          ))}
        </section>
      )}
    </div>
  )
}
