import { PackageOpen } from 'lucide-react'
import type { ReactNode } from 'react'

// Standard empty-state card with one clear action.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <PackageOpen className="size-8 text-slate-300" aria-hidden />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}