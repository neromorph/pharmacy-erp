'use client'

import { buildSipnapCsv, type SipnapReport } from '../../../lib/sipnap'

// Download the report as CSV. The server records the audit row separately.
export function DownloadButton({ report }: { report: SipnapReport }) {
  function download() {
    const blob = new Blob([buildSipnapCsv(report)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sipnap-${report.year}-${String(report.month).padStart(2, '0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button
      onClick={download}
      style={{
        background: 'var(--primary)',
        color: '#fff',
        padding: '8px 16px',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      Download Export
    </button>
  )
}
