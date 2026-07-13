import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-svgblue-100">
        <Icon className="h-7 w-7 text-svgblue-500" aria-hidden="true" />
      </span>
      <p className="text-base text-ink-muted">{message}</p>
      {action}
    </div>
  )
}
