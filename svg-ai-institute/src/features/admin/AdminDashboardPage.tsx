import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Award, Download, FileClock, Inbox, MessagesSquare,
  RefreshCw, Rocket, Sparkles, Users, Video, X,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { CountChip, HBar, MiniRing, Spark, StatCard, type ThemeColor } from './widgets'
import {
  astStamp, conversion, exportFunnelCsv,
  loadCohortHealth, loadEngagement, loadFunnel, loadMatrix, loadOps, loadWorkload,
  type CohortHealth, type Engagement, type Funnel, type MatrixRow, type OpsHealth, type Workload,
} from './dashboard'

interface CohortOption { id: string; name: string }

export function AdminDashboardPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [cohorts, setCohorts] = useState<CohortOption[]>([])
  const [cohortId, setCohortId] = useState<string>('') // '' = all
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [health, setHealth] = useState<CohortHealth[]>([])
  const [matrix, setMatrix] = useState<MatrixRow[]>([])
  const [workload, setWorkload] = useState<Workload | null>(null)
  const [engagement, setEngagement] = useState<Engagement | null>(null)
  const [ops, setOps] = useState<OpsHealth | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [stamp, setStamp] = useState(astStamp())
  const [drillUser, setDrillUser] = useState<MatrixRow | null>(null)

  useEffect(() => {
    supabase.from('cohorts').select('id, name').order('start_date', { ascending: false }).then(({ data }) => setCohorts(data ?? []))
  }, [])

  const refresh = useCallback(async () => {
    const [f, h, w] = await Promise.all([loadFunnel(), loadCohortHealth(), loadWorkload()])
    setFunnel(f)
    setHealth(h)
    setWorkload(w)
    if (isAdmin) {
      const [e, o] = await Promise.all([loadEngagement(), loadOps()])
      setEngagement(e)
      setOps(o)
    }
    setMatrix(cohortId ? await loadMatrix(cohortId) : [])
    setStamp(astStamp())
    setLoaded(true)
  }, [isAdmin, cohortId])

  useEffect(() => { void refresh() }, [refresh])

  // Auto-refresh every 60s
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh
  useEffect(() => {
    const t = setInterval(() => void refreshRef.current(), 60_000)
    return () => clearInterval(t)
  }, [])

  const scopedHealth = useMemo(() => (cohortId ? health.filter((h) => h.cohort_id === cohortId) : health), [health, cohortId])

  if (!loaded) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader title="Command Center" description="Read-only pulse of the whole institute." />
        <div className="flex flex-wrap items-center gap-2">
          <select value={cohortId} onChange={(e) => setCohortId(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink">
            <option value="">All cohorts</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="text-xs text-ink-muted">Updated {stamp} AST</span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* 2. Funnel */}
      {funnel && (
        <section className="flex flex-col gap-4" aria-label="Funnel">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl font-semibold text-ink">Funnel</h2>
            <Button size="sm" variant="secondary" onClick={() => exportFunnelCsv(funnel)}><Download className="h-4 w-4" /> Export CSV</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Interest" value={funnel.interest} icon={Users} sub="signups" />
            <StatCard label="Applications" value={funnel.applications} icon={Inbox} sub={<>{conversion(funnel.applications, funnel.interest)} of interest</>} />
            <StatCard label="Accepted" value={funnel.accepted} icon={Award} sub={<>{conversion(funnel.accepted, funnel.applications)} of apps</>} />
            <StatCard label="Enrolled" value={funnel.enrolled_active} icon={Users} sub={<>{conversion(funnel.enrolled_active, funnel.accepted)} of accepted</>} tone="green" />
            <StatCard label="Graduated" value={funnel.graduated} icon={Sparkles} sub={<>{conversion(funnel.graduated, funnel.enrolled_active + funnel.graduated)} completion</>} tone="gold" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card header="Applications by status">
              <div className="flex flex-col gap-3">
                {Object.keys(funnel.by_status).length === 0 ? (
                  <p className="text-sm text-ink-muted">No applications yet.</p>
                ) : (
                  Object.entries(funnel.by_status).map(([status, n]) => (
                    <HBar key={status} label={status.replace(/_/g, ' ')} value={n} max={funnel.applications}
                      tone={status === 'accepted' ? 'green' : status === 'declined' ? 'danger' : status === 'waitlisted' ? 'gold' : 'blue'} />
                  ))
                )}
              </div>
            </Card>
            <Card header="Applications per week (last 8)">
              <Spark data={funnel.weekly.map((w) => w.count)} tone="blue" width={280} height={60} />
              <p className="mt-2 text-xs text-ink-muted">{funnel.weekly.length} weeks · {funnel.weekly.reduce((a, w) => a + w.count, 0)} total</p>
            </Card>
          </div>
        </section>
      )}

      {/* 3. Cohort health */}
      <section className="flex flex-col gap-4" aria-label="Cohort health">
        <h2 className="font-heading text-xl font-semibold text-ink">Cohort health</h2>
        {scopedHealth.length === 0 ? (
          <Card><EmptyState icon={Users} message="No cohorts yet." /></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {scopedHealth.map((c) => (
              <Card key={c.cohort_id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-lg font-semibold text-ink">{c.name}</p>
                    <p className="text-sm text-ink-muted">{c.start_date ?? '—'} → {c.end_date ?? '—'}</p>
                    <Badge variant={c.status === 'active' ? 'green' : 'neutral'} className="mt-1">{c.status}</Badge>
                  </div>
                  <MiniRing pct={c.capacity > 0 ? Math.round((c.enrolled / c.capacity) * 100) : 0} tone="blue" label={<span className="text-xs">{c.enrolled}/{c.capacity}</span>} />
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <HBar label="Average progress" value={c.avg_progress} max={100} tone="green" suffix="%" />
                  <div className="flex items-center gap-3">
                    <span className="flex-1"><HBar label="On track" value={c.on_track} max={Math.max(1, c.on_track + c.slipping)} tone="green" /></span>
                    <span className="flex-1"><HBar label="Slipping" value={c.slipping} max={Math.max(1, c.on_track + c.slipping)} tone="warning" /></span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CountChip label="Requested" value={c.cap_requested} />
                    <CountChip label="Matched" value={c.cap_matched} tone="gold" />
                    <CountChip label="Submitted" value={c.cap_submitted} tone="gold" />
                    <CountChip label="Verified" value={c.cap_verified} tone="green" />
                    <CountChip label="Graduated" value={c.graduated} tone="green" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 4. Progress matrix */}
      <section className="flex flex-col gap-4" aria-label="Progress matrix">
        <h2 className="font-heading text-xl font-semibold text-ink">Student progress matrix</h2>
        {!cohortId ? (
          <Card><EmptyState icon={Users} message="Pick a cohort above to see the student matrix." /></Card>
        ) : matrix.length === 0 ? (
          <Card><EmptyState icon={Users} message="No students in this cohort yet." /></Card>
        ) : (
          <ProgressMatrix rows={matrix} onDrill={setDrillUser} />
        )}
      </section>

      {/* 5. Instructor workload */}
      {workload && (
        <section className="flex flex-col gap-4" aria-label="Workload">
          <h2 className="font-heading text-xl font-semibold text-ink">Teaching workload</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <QueueCard label="Assignments awaiting" count={workload.assignments_pending} oldest={workload.assignments_oldest_hours} to="/teach/review" />
            <QueueCard label="Capstone evidence" count={workload.capstones_pending} oldest={workload.capstones_oldest_hours} to="/teach/capstones" />
            <QueueCard label="Match requests" count={workload.matches_pending} oldest={workload.matches_oldest_hours} to="/teach/capstones" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:max-w-md">
            <StatCard label="Median review (assignments)" value={workload.median_assignment_hours != null ? `${workload.median_assignment_hours}h` : '—'} tone={(workload.median_assignment_hours ?? 0) > 48 ? 'gold' : 'blue'} sub="last 30 days" />
            <StatCard label="Median review (capstones)" value={workload.median_capstone_hours != null ? `${workload.median_capstone_hours}h` : '—'} tone={(workload.median_capstone_hours ?? 0) > 48 ? 'gold' : 'blue'} sub="last 30 days" />
          </div>
          <Card header="Reviewer throughput (last 30 days)">
            {workload.reviewers.length === 0 ? (
              <p className="text-sm text-ink-muted">No reviews in the last 30 days.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-line text-left text-ink-muted">
                    <th className="py-2 pr-4 font-medium">Reviewer</th><th className="py-2 pr-4 font-medium">Assignments</th><th className="py-2 pr-4 font-medium">Capstones</th><th className="py-2 font-medium">Median</th>
                  </tr></thead>
                  <tbody>
                    {workload.reviewers.map((r) => (
                      <tr key={r.name} className="border-b border-line last:border-0">
                        <td className="py-2 pr-4 font-medium text-ink">{r.name}</td>
                        <td className="py-2 pr-4 text-ink">{r.assignments}</td>
                        <td className="py-2 pr-4 text-ink">{r.capstones}</td>
                        <td className="py-2 text-ink-muted">{r.median_hours != null ? `${r.median_hours}h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* 6. Engagement (admin only) */}
      {isAdmin && engagement && (
        <section className="flex flex-col gap-4" aria-label="Engagement">
          <h2 className="font-heading text-xl font-semibold text-ink">Engagement</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card header="Class attendance (last 10)">
              {engagement.attendance.length === 0 ? <p className="text-sm text-ink-muted">No past classes.</p> : (
                <div className="flex flex-col gap-3">
                  {engagement.attendance.map((a, i) => {
                    const rate = a.eligible > 0 ? Math.round((a.attendees / a.eligible) * 100) : 0
                    return <HBar key={i} label={a.title} value={rate} max={100} tone={rate >= 60 ? 'green' : 'gold'} suffix={`% (${a.attendees}/${a.eligible})`} />
                  })}
                </div>
              )}
            </Card>
            <Card header="Community (7 days)">
              <Spark data={engagement.community.by_day.map((d) => d.count)} tone="blue" width={240} height={50} />
              <p className="mt-2 text-sm text-ink-muted"><strong className="text-ink">{engagement.community.by_day.reduce((a, d) => a + d.count, 0)}</strong> messages · <strong className="text-ink">{engagement.community.posters}</strong> posters</p>
            </Card>
            <Card header="Coach usage (7 days)">
              <Spark data={engagement.coach.by_day.map((d) => d.count)} tone="gold" width={240} height={50} />
              <p className="mt-2 text-sm text-ink-muted"><strong className="text-ink">{engagement.coach.by_day.reduce((a, d) => a + d.count, 0)}</strong> messages · <strong className="text-ink">{engagement.coach.users}</strong> users · {engagement.coach.avg_per_user}/user</p>
              <p className="mt-1 text-xs text-ink-muted">Counts only — chat content stays private.</p>
            </Card>
          </div>
        </section>
      )}

      {/* 7. Ops health (admin only) */}
      {isAdmin && ops && (
        <section className="flex flex-col gap-4" aria-label="Ops health">
          <h2 className="font-heading text-xl font-semibold text-ink">Ops health</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card header="Email outbox">
              <div className="flex flex-wrap items-center gap-2">
                <CountChip label="Pending" value={ops.outbox.pending} />
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ops.outbox.failed > 0 ? 'bg-svggold-100 text-danger' : 'bg-svggreen-100 text-svggreen-700'}`}>Failed <strong>{ops.outbox.failed}</strong></span>
                <CountChip label="Sent 24h" value={ops.outbox.sent_24h} tone="green" />
              </div>
              {ops.outbox.recent_failures.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs font-medium text-ink-muted">Recent failures</p>
                  {ops.outbox.recent_failures.map((f, i) => (
                    <div key={i} className="rounded-lg bg-surface-alt px-3 py-2 text-xs text-ink-muted">
                      <span className="font-medium text-ink">@{f.domain}</span> · {f.template} · <span className="text-danger">{f.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card header="Business pipeline">
              <div className="flex items-center gap-4">
                <MiniRing pct={ops.business.capacity > 0 ? Math.round((ops.business.active_projects / ops.business.capacity) * 100) : 0} tone="blue" label={<span className="text-xs">{ops.business.active_projects}/{ops.business.capacity}</span>} />
                <div className="flex flex-col gap-1 text-sm text-ink">
                  <span>Capacity utilization</span>
                  <span className="text-ink-muted">{ops.business.approved} approved businesses</span>
                  {ops.business.pending > 0 && <Link to="/admin/businesses" className="font-medium text-svgblue-500 hover:text-svgblue-700">{ops.business.pending} pending approval →</Link>}
                </div>
              </div>
            </Card>
            <Card header="Content flags">
              <div className="flex flex-col gap-2 text-sm">
                <FlagRow icon={Video} label="Unpublished linked recordings" value={ops.content_flags.unpublished_linked_recordings} to="/admin/showcase" />
                <FlagRow icon={FileClock} label="Videos stuck processing >24h" value={ops.content_flags.stuck_processing} to="/admin/rooms" />
              </div>
            </Card>
          </div>
        </section>
      )}

      {drillUser && <StudentDrawer row={drillUser} onClose={() => setDrillUser(null)} />}
    </div>
  )
}


function QueueCard({ label, count, oldest, to }: { label: string; count: number; oldest: number; to: string }) {
  const tone: ThemeColor = count >= 10 ? 'gold' : 'blue'
  const age = oldest >= 24 ? `${Math.floor(oldest / 24)}d` : `${oldest}h`
  return (
    <Link to={to}>
      <StatCard label={label} value={count} tone={tone} icon={Inbox} sub={count > 0 ? <>oldest: {age}</> : 'clear ✓'} />
    </Link>
  )
}

function FlagRow({ icon: Icon, label, value, to }: { icon: typeof Video; label: string; value: number; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-ink"><Icon className="h-4 w-4 text-ink-muted" aria-hidden="true" /> {label}</span>
      {value > 0 ? (
        <Link to={to} className="flex items-center gap-1 font-medium text-warning hover:underline"><AlertTriangle className="h-4 w-4" /> {value}</Link>
      ) : (
        <span className="text-svggreen-700">0 ✓</span>
      )}
    </div>
  )
}

function cellState(done: number, required: number): { cls: string; title: string } {
  if (required === 0) return { cls: 'bg-surface-alt border border-line', title: 'no required lessons' }
  if (done >= required) return { cls: 'bg-svggreen-500', title: 'complete' }
  if (done > 0) return { cls: 'bg-svggold-500', title: 'in progress' }
  return { cls: 'border-2 border-line bg-white', title: 'untouched' }
}

function ProgressMatrix({ rows, onDrill }: { rows: MatrixRow[]; onDrill: (r: MatrixRow) => void }) {
  const modules = rows[0]?.module_states ?? []
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-ink-muted">Student</th>
            {modules.map((m, i) => <th key={m.module_id} className="px-2 py-3 text-center font-medium text-ink-muted" title={m.title}>W{i + 1}</th>)}
            <th className="px-3 py-3 text-right font-medium text-ink-muted">%</th>
            <th className="px-3 py-3 text-left font-medium text-ink-muted">Capstone</th>
            <th className="px-3 py-3 text-right font-medium text-ink-muted">Streak</th>
            <th className="px-3 py-3 text-right font-medium text-ink-muted">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user_id} className="border-b border-line last:border-0 hover:bg-svgblue-50">
              <td className="sticky left-0 z-10 bg-white px-4 py-3">
                <button type="button" onClick={() => onDrill(r)} className="font-medium text-svgblue-500 hover:underline">{r.student_name.trim() || 'Student'}</button>
              </td>
              {(r.module_states ?? []).map((m) => {
                const s = cellState(m.done, m.required)
                return <td key={m.module_id} className="px-2 py-3 text-center"><span className={`inline-block h-5 w-5 rounded ${s.cls}`} title={`${m.title}: ${s.title}`} /></td>
              })}
              <td className="px-3 py-3 text-right font-medium text-ink">{r.overall_pct}%</td>
              <td className="px-3 py-3"><Badge variant={r.capstone_status === 'verified' ? 'green' : r.capstone_status === 'none' ? 'neutral' : 'gold'}>{r.capstone_status}</Badge></td>
              <td className="px-3 py-3 text-right text-ink">{r.current_streak}</td>
              <td className="px-3 py-3 text-right text-ink">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SubmissionLite { id: string; lesson_id: string; status: string; created_at: string; reviewed_at: string | null }
interface AttendanceLite { class_id: string; joined_at: string; title: string }

function StudentDrawer({ row, onClose }: { row: MatrixRow; onClose: () => void }) {
  const [subs, setSubs] = useState<SubmissionLite[]>([])
  const [att, setAtt] = useState<AttendanceLite[]>([])

  useEffect(() => {
    supabase.from('submissions').select('id, lesson_id, status, created_at, reviewed_at').eq('user_id', row.user_id).order('created_at', { ascending: false }).then(({ data }) => setSubs(data ?? []))
    void (async () => {
      const { data: rows } = await supabase.from('class_attendance').select('class_id, joined_at').eq('user_id', row.user_id).order('joined_at', { ascending: false })
      const ids = [...new Set((rows ?? []).map((r) => r.class_id))]
      const { data: classes } = await supabase.from('live_classes').select('id, title').in('id', ids.length ? ids : ['x'])
      const titleById = new Map((classes ?? []).map((c) => [c.id, c.title]))
      setAtt((rows ?? []).map((r) => ({ class_id: r.class_id, joined_at: r.joined_at, title: titleById.get(r.class_id) ?? 'Class' })))
    })()
  }, [row.user_id])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-svgblue-900/30" onClick={onClose} role="presentation">
      <div className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-heading text-lg font-semibold text-ink">{row.student_name.trim() || 'Student'}</p>
            <p className="text-sm text-ink-muted">{row.overall_pct}% · {row.points} pts · {row.current_streak}-day streak</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-svgblue-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex flex-col gap-6 p-5">
          <section>
            <h3 className="mb-2 font-heading text-sm font-semibold text-ink">Progress by week</h3>
            <div className="flex flex-col gap-2">
              {(row.module_states ?? []).map((m, i) => (
                <HBar key={m.module_id} label={`W${i + 1} · ${m.title.replace(/^Week \d+ — /, '')}`} value={m.done} max={Math.max(1, m.required)} tone={m.done >= m.required && m.required > 0 ? 'green' : 'gold'} suffix={`/${m.required}`} />
              ))}
            </div>
          </section>
          <section>
            <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink"><Award className="h-4 w-4" /> Submissions</h3>
            {subs.length === 0 ? <p className="text-sm text-ink-muted">No submissions.</p> : (
              <div className="flex flex-col gap-1">
                {subs.map((s) => (
                  <Link key={s.id} to={`/learn/lesson/${s.lesson_id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-svgblue-50">
                    <span className="text-ink">{new Date(s.created_at).toLocaleDateString()}</span>
                    <Badge variant={s.status === 'approved' ? 'green' : s.status === 'changes_requested' ? 'gold' : 'neutral'}>{s.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section>
            <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold text-ink"><Video className="h-4 w-4" /> Attendance</h3>
            {att.length === 0 ? <p className="text-sm text-ink-muted">No classes attended.</p> : (
              <ul className="flex flex-col gap-1 text-sm text-ink">
                {att.map((a, i) => <li key={i} className="flex justify-between"><span>{a.title}</span><span className="text-ink-muted">{new Date(a.joined_at).toLocaleDateString()}</span></li>)}
              </ul>
            )}
          </section>
          <div className="flex flex-wrap gap-2">
            <Link to="/teach/review"><Button size="sm" variant="secondary"><Inbox className="h-4 w-4" /> Review queue</Button></Link>
            <Link to="/teach/capstones"><Button size="sm" variant="secondary"><Rocket className="h-4 w-4" /> Capstones</Button></Link>
            <Link to="/community"><Button size="sm" variant="ghost"><MessagesSquare className="h-4 w-4" /> Community</Button></Link>
          </div>
        </div>
      </div>
    </div>
  )
}

