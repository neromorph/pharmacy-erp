import { Pill } from 'lucide-react'

// Compact brand mark: teal rounded square with pill icon + name text.
export function Logo({ name = 'Pharmacy ERP' }: { name?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-md bg-primary text-white">
        <Pill className="size-5" />
      </div>
      <span className="truncate font-semibold text-slate-900">{name}</span>
    </div>
  )
}