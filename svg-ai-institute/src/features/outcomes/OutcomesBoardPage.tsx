import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DiamondMotif } from '../../components/ui/DiamondMotif'
import { EmptyState } from '../../components/ui/EmptyState'
import { Seo } from '../../components/ui/Seo'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import type { ShowcaseEntry } from '../../lib/types'
import { ISLANDS } from '../capstone/capstone'
import { DeployedBadge } from './DeployedBadge'
import { PUBLIC_SHOWCASE_COLUMNS, photoUrl, typeLabel } from './outcomes'

export function OutcomesBoardPage() {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([])
  const [stats, setStats] = useState<{ graduates: number; deployed: number; businesses: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [islandFilter, setIslandFilter] = useState('all')

  useEffect(() => {
    Promise.all([
      supabase.from('showcase_entries').select(PUBLIC_SHOWCASE_COLUMNS).eq('status', 'published').order('published_at', { ascending: false }),
      supabase.rpc('get_outcome_stats'),
    ]).then(([{ data: e }, { data: s }]) => {
      setEntries((e ?? []) as ShowcaseEntry[])
      if (s && s.length > 0) setStats(s[0])
      setLoaded(true)
    })
  }, [])

  const visible = useMemo(() => {
    let list = entries
    if (typeFilter !== 'all') list = list.filter((e) => e.project_type === typeFilter)
    if (islandFilter !== 'all') list = list.filter((e) => e.island === islandFilter)
    return list
  }, [entries, typeFilter, islandFilter])

  return (
    <>
      <Seo
        title="Outcomes"
        description="Real deployed AI systems built by Vincentian students for real SVG businesses — every one instructor-verified and consent-published."
        path="/outcomes"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-svgblue-50">
        <DiamondMotif size={360} opacity={0.1} className="-right-20 -top-8 hidden md:block" />
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h1 className="font-heading text-3xl font-bold text-ink md:text-4xl">
            Real systems. Real businesses. Real proof.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
            Every project here was built by a student, tested and verified by an instructor, and
            published with the business&apos;s and student&apos;s consent.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-surface-page">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-3">
          {[
            { n: stats?.graduates ?? 0, label: 'Graduates' },
            { n: stats?.deployed ?? 0, label: 'Systems deployed' },
            { n: stats?.businesses ?? 0, label: 'Businesses served' },
          ].map((s) => (
            <Card key={s.label}>
              <p className="font-heading text-4xl font-bold text-svgblue-500">{s.n}</p>
              <p className="mt-1 text-base text-ink-muted">{s.label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Grid */}
      <section className="bg-svgblue-50">
        <div className="mx-auto max-w-6xl px-4 py-12">
          {!loaded ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : entries.length === 0 ? (
            <Card>
              <EmptyState
                icon={Rocket}
                message="Cohort 1 is building right now. The first deployed systems land here soon."
                action={<Link to="/apply"><Button>Apply for the next cohort</Button></Link>}
              />
            </Card>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap gap-3">
                <select aria-label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500 sm:flex-none">
                  <option value="all">All types</option>
                  <option value="whatsapp_bot">WhatsApp bot</option>
                  <option value="automation">Automation</option>
                  <option value="voice_agent">Voice agent</option>
                </select>
                <select aria-label="Island" value={islandFilter} onChange={(e) => setIslandFilter(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-svgblue-500 sm:flex-none">
                  <option value="all">All islands</option>
                  {ISLANDS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((e) => (
                  <Link key={e.id} to={`/outcomes/${e.slug}`}>
                    <Card className="h-full overflow-hidden p-0">
                      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-svgblue-500 to-svggreen-500">
                        {photoUrl(e.photo_path) ? (
                          <img src={photoUrl(e.photo_path)!} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <DiamondMotif size={160} opacity={0.25} colorClass="text-white" className="left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <DeployedBadge />
                          <Badge variant="blue">{typeLabel(e.project_type)}</Badge>
                        </div>
                        <p className="font-heading text-lg font-semibold text-ink">{e.display_name}</p>
                        <p className="text-sm text-ink-muted">{e.business_name} · {e.island}</p>
                        {e.headline && <p className="text-base text-ink">{e.headline}</p>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  )
}
