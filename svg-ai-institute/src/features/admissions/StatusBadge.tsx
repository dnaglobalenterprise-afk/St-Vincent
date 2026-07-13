import { Badge } from '../../components/ui/Badge'
import type { ApplicationStatus } from '../../lib/types'

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  declined: 'Declined',
}

const STATUS_VARIANTS: Record<ApplicationStatus, 'blue' | 'gold' | 'green' | 'warning' | 'neutral'> = {
  submitted: 'blue',
  under_review: 'gold',
  accepted: 'green',
  waitlisted: 'warning',
  declined: 'neutral',
}

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
}
