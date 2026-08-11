'use client'

import { Input } from '@/components/ui/input'

// Physical qty field that highlights when the count differs from the system.
export function QtyInput({
  name,
  defaultValue,
  systemQty,
}: {
  name: string
  defaultValue: number
  systemQty: number
}) {
  return (
    <Input
      type="number"
      step="0.001"
      name={name}
      defaultValue={defaultValue}
      className={[
        'tabular-nums',
        Number.isFinite(defaultValue) && defaultValue !== systemQty ? 'border-amber-500' : '',
      ].join(' ')}
      onInput={(e) => {
        const el = e.currentTarget
        const v = Number(el.value)
        el.classList.toggle(
          'border-amber-500',
          Number.isFinite(v) && v !== systemQty
        )
      }}
    />
  )
}