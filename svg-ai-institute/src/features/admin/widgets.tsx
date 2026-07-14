import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react'

const COLORS = {
  blue: { bar: 'bg-svgblue-500', text: 'text-svgblue-700', ring: '#0072C6' },
  green: { bar: 'bg-svggreen-500', text: 'text-svggreen-700', ring: '#009639' },
  gold: { bar: 'bg-svggold-500', text: 'text-svggold-600', ring: '#FCD116' },
  warning: { bar: 'bg-[#E8890C]', text: 'text-warning', ring: '#E8890C' },
  danger: { bar: 'bg-[#D64545]', text: 'text-danger', ring: '#D64545' },
} as const

export type ThemeColor = keyof typeof COLORS

/** Big Sora number, label, optional sub-line and delta. */
export function StatCard({
  value, label, sub, delta, icon: Icon, tone = 'blue', onClick,
}: {
  value: ReactNode
  label: string
  sub?: ReactNode
  delta?: number
  icon?: LucideIcon
  tone?: ThemeColor
  onClick?: () => void
}) {
  const toneClass = tone === 'gold' ? 'border-svggold-500 bg-svggold-100' : tone === 'danger' ? 'border-danger bg-svggold-50' : 'border-line bg-white'
  return (
    <div
      onClick={onClick}
      className={`flex flex-col gap-1 rounded-xl border p-4 shadow-card ${toneClass} ${onClick ? 'cursor-pointer hover:border-svgblue-500' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-muted">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${COLORS[tone].text}`} aria-hidden="true" />}
      </div>
      <span className="font-heading text-3xl font-bold text-ink">{value}</span>
      {(sub || delta != null) && (
        <span className="flex items-center gap-1 text-sm text-ink-muted">
          {delta != null && (
            <span className={`flex items-center ${delta >= 0 ? 'text-svggreen-700' : 'text-danger'}`}>
              {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(delta)}%
            </span>
          )}
          {sub}
        </span>
      )}
    </div>
  )
}

/** Labeled horizontal bar. value/max drive width; theme color prop. */
export function HBar({ label, value, max, tone = 'blue', suffix }: { label: string; value: number; max: number; tone?: ThemeColor; suffix?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="text-ink-muted">{value}{suffix ?? ''}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-svgblue-100">
        <div className={`h-full rounded-full ${COLORS[tone].bar} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Progress ring with a centered label. */
export function MiniRing({ pct, tone = 'blue', size = 72, label }: { pct: number; tone?: ThemeColor; size?: number; label?: ReactNode }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#D6EBFA" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS[tone].ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - clamped / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <span className="font-heading text-sm font-bold text-ink">{label ?? `${clamped}%`}</span>
      </div>
    </div>
  )
}

/** Tiny sparkline from an int array (theme color). */
export function Spark({ data, tone = 'blue', width = 160, height = 40 }: { data: number[]; tone?: ThemeColor; width?: number; height?: number }) {
  if (data.length === 0) return <div className="h-10 text-sm text-ink-muted">No data</div>
  const max = Math.max(1, ...data)
  const step = data.length > 1 ? width / (data.length - 1) : width
  const pts = data.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={COLORS[tone].ring} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => (
        <circle key={i} cx={i * step} cy={height - (v / max) * (height - 4) - 2} r="2" fill={COLORS[tone].ring} />
      ))}
    </svg>
  )
}

/** Small labeled count chip (for capstone pipeline etc.). */
export function CountChip({ label, value, tone = 'blue' }: { label: string; value: number; tone?: ThemeColor }) {
  const bg = tone === 'green' ? 'bg-svggreen-100 text-svggreen-700' : tone === 'gold' ? 'bg-svggold-100 text-svggold-600' : 'bg-svgblue-100 text-svgblue-700'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${bg}`}>{label} <strong>{value}</strong></span>
}
