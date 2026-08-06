'use client'

import { buildAgingCsv, type PayableCsvRow } from '../../../lib/purchase-returns'

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
    <button
      onClick={download}
      style={{
        background: 'transparent',
        color: 'var(--primary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Download CSV
    </button>
  )
}
