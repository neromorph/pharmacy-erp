'use client'

import { useState } from 'react'
import { buildSipnapV2Csv, type SipnapV2Report } from '../../../lib/sipnap-v2'
import { recordSipnapExport } from './actions'

// Store the exact CSV in the archive bucket, then download the same file
// in the browser. The stored file is the audit artifact.
export function DownloadButton({ report }: { report: SipnapV2Report }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      await recordSipnapExport(report)
      const blob = new Blob([buildSipnapV2Csv(report)], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sipnap-${report.year}-${String(report.month).padStart(2, '0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        onClick={download}
        disabled={busy}
        style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '8px 16px',
          border: 'none',
          borderRadius: 6,
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Storing export…' : 'Download Export'}
      </button>
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}
