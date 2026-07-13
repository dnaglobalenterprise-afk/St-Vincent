import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'
import { Radio, Video } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { LiveClass } from '../../lib/types'
import { Markdown } from '../learning/Markdown'
import { countdown, formatAst, joinOpen } from './classtime'

export function LiveClassPage() {
  const { id } = useParams<{ id: string }>()
  const [cls, setCls] = useState<LiveClass | null>(null)
  const [hostName, setHostName] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => 0)
  const attendanceFired = useRef(false)

  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    const load = async () => {
      const { data } = await supabase.from('live_classes').select('*').eq('id', id).maybeSingle()
      if (cancelled) return
      const c = data as LiveClass | null
      setCls(c)
      if (c) {
        const { data: host } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', c.host_id)
          .maybeSingle()
        if (host) setHostName([host.first_name, host.last_name].filter(Boolean).join(' ') || host.email)
      }
      setLoaded(true)
    }
    void load()
    // poll status while on the page so LIVE/ended flips reflect
    const poll = setInterval(load, 20_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [id])

  // Record attendance when the live view first renders
  useEffect(() => {
    if (cls && cls.status === 'live' && id && !attendanceFired.current) {
      attendanceFired.current = true
      void supabase.rpc('record_attendance', { p_class_id: id })
    }
  }, [cls, id])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!cls) {
    return (
      <Card>
        <EmptyState
          icon={Video}
          message="This class isn't available to you."
          action={
            <Link to="/learn/classes">
              <Button>Back to schedule</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  const nowT = now || Date.now()
  const cd = countdown(cls.scheduled_at, cls.duration_minutes, nowT)
  const preLive = !joinOpen(cls.scheduled_at, cls.duration_minutes, nowT) && !cd.ended

  return (
    <div className="flex flex-col gap-6">
      <Link to="/learn/classes" className="text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
        ← Back to schedule
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="font-heading text-3xl font-bold text-ink">{cls.title}</h1>
        {cls.status === 'live' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-svggold-500 px-3 py-1 text-sm font-semibold text-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            LIVE
          </span>
        )}
      </div>
      <p className="text-base text-ink-muted">
        {formatAst(cls.scheduled_at)} · Host {hostName}
      </p>

      {cls.status === 'live' && cls.mux_live_playback_id ? (
        <div className="overflow-hidden rounded-xl">
          <MuxPlayer
            playbackId={cls.mux_live_playback_id}
            streamType="live"
            autoPlay
            style={{ aspectRatio: '16 / 9', width: '100%' }}
          />
        </div>
      ) : cls.status === 'ended' || cd.ended ? (
        <Card className="bg-surface-alt">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Video className="h-10 w-10 text-ink-muted" aria-hidden="true" />
            <p className="text-base text-ink">
              Class has ended. The replay will appear in your library shortly.
            </p>
            <Link to="/learn/replays">
              <Button variant="secondary">Go to Replays</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="bg-svgblue-50">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Radio className="h-10 w-10 text-svgblue-500" aria-hidden="true" />
            <p className="font-heading text-xl font-semibold text-ink">
              {preLive ? `Starts ${cd.label}` : 'Waiting for the host to go live…'}
            </p>
            <p className="text-base text-ink-muted">Keep this page open — the stream appears here when it begins.</p>
          </div>
        </Card>
      )}

      {cls.description && (
        <Card>
          <Markdown source={cls.description} />
        </Card>
      )}
    </div>
  )
}
