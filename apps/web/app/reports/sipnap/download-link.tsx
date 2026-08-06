'use client'

import { useState } from 'react'
import { getStoredExport } from './actions'

// One download link per history row. Fetches the stored snapshot CSV and
// downloads it in the browser. The stored file is never recomputed.
export function ExportDownloadLink({ exportId }: { exportId: string }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const { csv } = await getStoredExport(exportId)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sipnap-export-${exportId.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // silent: the action throws a readable message on failure
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={busy}
      style={{
        background: 'transparent',
        color: 'var(--primary)',
        border: '1px solid var(--primary)',
        borderRadius: 6,
        padding: '4px 10px',
        fontSize: 12,
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? '…' : 'Download'}
    </button>
  )
}
