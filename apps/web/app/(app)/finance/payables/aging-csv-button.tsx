'use client'

import { buildAgingCsv, type PayableCsvRow } from '../../../../lib/purchase-returns'
import { Button } from '@/components/ui/button'

export function AgingCsvButton({ rows }: { rows: PayableCsvRow[] }) {
  function download() {
    const csv = buildAgingCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `aging-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      Unduh CSV
    </Button>
  )
}
