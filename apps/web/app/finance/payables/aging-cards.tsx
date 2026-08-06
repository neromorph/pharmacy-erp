import type { AgingBucket } from '../../../lib/purchase-returns'

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
      {summaries.map((s) => (
        <div
          key={s.bucket}
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            borderTop: `3px solid ${bucketColors[s.bucket]}`,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{bucketLabels[s.bucket]}</div>
          <div style={{ fontSize: 18, fontWeight: 600, margin: '4px 0' }}>{s.total.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.count} invoice(s)</div>
        </div>
      ))}
    </div>
  )
}
