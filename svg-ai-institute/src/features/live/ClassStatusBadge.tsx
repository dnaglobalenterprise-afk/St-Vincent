import { Badge } from '../../components/ui/Badge'
import type { LiveClassStatus } from '../../lib/types'

export function ClassStatusBadge({ status }: { status: LiveClassStatus }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-svggold-500 px-2.5 py-0.5 text-sm font-semibold text-ink">
        <span className="h-2 w-2 animate-pulse rounded-full bg-danger" aria-hidden="true" />
        LIVE
      </span>
    )
  }
  const map: Record<Exclude<LiveClassStatus, 'live'>, { label: string; variant: 'blue' | 'neutral' }> = {
    scheduled: { label: 'Scheduled', variant: 'blue' },
    ended: { label: 'Ended', variant: 'neutral' },
    cancelled: { label: 'Cancelled', variant: 'neutral' },
  }
  const m = map[status]
  return <Badge variant={m.variant}>{m.label}</Badge>
}
