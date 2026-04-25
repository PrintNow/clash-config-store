import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  actions?: ReactNode
}

export function EmptyState({ title, description, actions }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  )
}
