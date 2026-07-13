import { BadgeCheck } from 'lucide-react'

export function DeployedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-svggreen-500 px-2.5 py-0.5 text-sm font-semibold text-white">
      <BadgeCheck className="h-4 w-4" aria-hidden="true" />
      DEPLOYED
    </span>
  )
}
