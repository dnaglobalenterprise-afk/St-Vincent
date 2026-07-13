import type { ReactNode } from 'react'

interface CardProps {
  header?: ReactNode
  children: ReactNode
  className?: string
}

export function Card({ header, children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-card ${className}`}>
      {header && (
        <div className="border-b border-line px-6 py-4 font-heading font-semibold text-ink">
          {header}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}
