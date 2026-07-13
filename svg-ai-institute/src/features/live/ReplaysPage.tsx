import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MuxPlayer from '@mux/mux-player-react'
import { Clapperboard } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { Recording } from '../../lib/types'
import { Markdown } from '../learning/Markdown'
import { formatAstDate } from './classtime'

function durationLabel(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ReplaysPage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [hosts, setHosts] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase
      .from('recordings')
      .select('*')
      .eq('status', 'ready')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .then(async ({ data }) => {
        if (cancelled) return
        const recs = (data ?? []) as Recording[]
        setRecordings(recs)
        const classIds = recs.map((r) => r.class_id).filter(Boolean) as string[]
        if (classIds.length) {
          const { data: classes } = await supabase.from('live_classes').select('id, host_id').in('id', classIds)
          const hostIds = [...new Set((classes ?? []).map((c) => c.host_id))]
          const { data: profiles } = await supabase.from('profiles').select('id, first_name, last_name, email').in('id', hostIds.length ? hostIds : ['x'])
          const nameById: Record<string, string> = {}
          for (const p of profiles ?? []) nameById[p.id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email
          const map: Record<string, string> = {}
          for (const c of classes ?? []) map[c.id] = nameById[c.host_id] ?? ''
          setHosts(map)
        }
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? recordings.filter((r) => r.title.toLowerCase().includes(q)) : recordings
  }, [recordings, search])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Replays" description="Every class, recorded. Watch any time." />
      <div className="max-w-md">
        <Input name="replay-search" aria-label="Search replays" placeholder="Search replays…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={Clapperboard} message="No replays yet." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r) => (
            <Link key={r.id} to={`/learn/replays/${r.id}`}>
              <Card className="h-full overflow-hidden p-0">
                <div className="aspect-video w-full bg-surface-alt">
                  {r.mux_playback_id && (
                    <img
                      src={`https://image.mux.com/${r.mux_playback_id}/thumbnail.jpg?width=640`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1 px-4 py-3">
                  <p className="font-heading text-base font-semibold text-ink">{r.title}</p>
                  <p className="text-sm text-ink-muted">
                    {formatAstDate(r.created_at)}
                    {r.duration_seconds ? ` · ${durationLabel(r.duration_seconds)}` : ''}
                    {r.class_id && hosts[r.class_id] ? ` · ${hosts[r.class_id]}` : ''}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReplayPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const [rec, setRec] = useState<Recording | null>(null)
  const [hostName, setHostName] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('recordings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        const r = data as Recording | null
        setRec(r)
        if (r?.class_id) {
          const { data: cls } = await supabase.from('live_classes').select('host_id').eq('id', r.class_id).maybeSingle()
          if (cls) {
            const { data: host } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', cls.host_id).maybeSingle()
            if (host) setHostName([host.first_name, host.last_name].filter(Boolean).join(' ') || host.email)
          }
        }
        setLoaded(true)
      })
  }, [id])

  if (!loaded) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!rec || !rec.mux_playback_id) {
    return (
      <Card>
        <EmptyState
          icon={Clapperboard}
          message="This replay isn't available."
          action={
            <Link to="/learn/replays">
              <Button>Back to Replays</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/learn/replays" className="text-sm font-medium text-svgblue-500 hover:text-svgblue-700">
        ← Back to Replays
      </Link>
      <h1 className="font-heading text-3xl font-bold text-ink">{rec.title}</h1>
      <p className="text-base text-ink-muted">
        {formatAstDate(rec.created_at)}
        {hostName ? ` · Host ${hostName}` : ''}
      </p>
      <div className="overflow-hidden rounded-xl">
        <MuxPlayer playbackId={rec.mux_playback_id} streamType="on-demand" style={{ aspectRatio: '16 / 9', width: '100%' }} />
      </div>
      {rec.description && (
        <Card>
          <Markdown source={rec.description} />
        </Card>
      )}
    </div>
  )
}
