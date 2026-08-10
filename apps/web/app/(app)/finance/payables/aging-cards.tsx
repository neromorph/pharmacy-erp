import type { AgingBucket } from '../../../../lib/purchase-returns'
import { Card, CardContent } from '@/components/ui/card'

export interface BucketSummary {
  bucket: AgingBucket
  count: number
  total: number
}

const bucketLabels: Record<AgingBucket, string> = {
  CURRENT: 'Belum Jatuh Tempo',
  '1-30': '1-30 Hari',
  '31-60': '31-60 Hari',
  '61-90': '61-90 Hari',
  '90+': '> 90 Hari',
}

const bucketColors: Record<AgingBucket, string> = {
  CURRENT: '#0d9488',
  '1-30': '#f59e0b',
  '31-60': '#f97316',
  '61-90': '#ef4444',
  '90+': '#7f1d1d',
}

export function AgingCards({ summaries }: { summaries: BucketSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {summaries.map((s) => (
        <Card key={s.bucket} style={{ borderTop: `3px solid ${bucketColors[s.bucket]}` }}>
          <CardContent className="pt-1">
            <p className="text-xs text-slate-500">{bucketLabels[s.bucket]}</p>
            <p className="my-1 text-lg font-semibold tabular-nums text-slate-900">{s.total.toFixed(2)}</p>
            <p className="text-xs text-slate-500">{s.count} faktur</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
