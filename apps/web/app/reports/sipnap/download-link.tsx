'use client'

import { useState } from 'react'
import { getExportDownloadUrl } from './actions'

// One download link per history row. Fetches a signed URL on click.
export function ExportDownloadLink({ exportId }: { exportId: string }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const url = await getExportDownloadUrl(exportId)
      window.open(url, '_blank')
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
