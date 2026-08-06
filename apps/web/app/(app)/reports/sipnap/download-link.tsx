'use client'

import { useState } from 'react'
import { getStoredExport } from './actions'
import { Button } from '@/components/ui/button'

// One download link per history row. Fetches the stored snapshot (bucket file
// via signed URL, or DB payload csv for pre-fix rows) and downloads it. The
// stored file is never recomputed.
export function ExportDownloadLink({ exportId }: { exportId: string }) {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const res = await getStoredExport(exportId)
      if (res.url) {
        window.open(res.url, '_blank')
      } else if (res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `sipnap-export-${exportId.slice(0, 8)}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // silent: the action throws a readable message on failure
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={busy}>
      {busy ? '…' : 'Download'}
    </Button>
  )
}
