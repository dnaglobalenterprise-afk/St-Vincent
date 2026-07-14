import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/types'

type Fn = Database['public']['Functions']
export type Funnel = Fn['get_admin_funnel']['Returns'][number]
export type CohortHealth = Fn['get_cohort_health']['Returns'][number]
export type MatrixRow = Fn['get_progress_matrix']['Returns'][number]
export type Workload = Fn['get_review_workload']['Returns'][number]
export type Engagement = Fn['get_engagement_stats']['Returns'][number]
export type OpsHealth = Fn['get_ops_health']['Returns'][number]

export async function loadFunnel(): Promise<Funnel | null> {
  const { data } = await supabase.rpc('get_admin_funnel')
  return data?.[0] ?? null
}
export async function loadCohortHealth(): Promise<CohortHealth[]> {
  const { data } = await supabase.rpc('get_cohort_health')
  return data ?? []
}
export async function loadMatrix(cohortId: string): Promise<MatrixRow[]> {
  const { data } = await supabase.rpc('get_progress_matrix', { p_cohort_id: cohortId })
  return data ?? []
}
export async function loadWorkload(): Promise<Workload | null> {
  const { data } = await supabase.rpc('get_review_workload')
  return data?.[0] ?? null
}
export async function loadEngagement(): Promise<Engagement | null> {
  const { data } = await supabase.rpc('get_engagement_stats')
  return data?.[0] ?? null
}
export async function loadOps(): Promise<OpsHealth | null> {
  const { data } = await supabase.rpc('get_ops_health')
  return data?.[0] ?? null
}

export function astStamp(): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/St_Vincent', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date())
}

/** Client-side CSV of the funnel numbers + weekly series — the Ministry artifact. */
export function exportFunnelCsv(f: Funnel): void {
  const lines: string[] = []
  lines.push('SVG AI Institute — Funnel Report')
  lines.push('')
  lines.push('Stage,Count')
  lines.push(`Interest signups,${f.interest}`)
  lines.push(`Applications,${f.applications}`)
  lines.push(`Accepted,${f.accepted}`)
  lines.push(`Currently enrolled,${f.enrolled_active}`)
  lines.push(`Graduated,${f.graduated}`)
  lines.push('')
  lines.push('Application status,Count')
  for (const [status, n] of Object.entries(f.by_status)) lines.push(`${status},${n}`)
  lines.push('')
  lines.push('Week starting,Applications')
  for (const w of f.weekly) lines.push(`${w.week_start},${w.count}`)

  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/St_Vincent' }).format(new Date())
  a.href = url
  a.download = `svgai-funnel-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function conversion(curr: number, prev: number): string {
  if (prev <= 0) return '—'
  return `${Math.round((curr / prev) * 100)}%`
}
