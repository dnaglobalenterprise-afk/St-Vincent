import type { ReactNode } from 'react'

type BadgeVariant = 'blue' | 'gold' | 'green' | 'neutral'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  blue: 'bg-svgblue-100 text-svgblue-700',
  gold: 'bg-svggold-500 text-ink',
  green: 'bg-svggreen-100 text-svggreen-700',
  neutral: 'bg-surface-alt text-ink-muted',
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
