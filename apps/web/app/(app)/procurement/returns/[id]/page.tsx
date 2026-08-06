import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ret } = await supabase
    .from('purchase_returns')
    .select('*, supplier:suppliers(name)')
    .eq('id', id)
    .single()

  if (!ret) return <p>Return not found</p>

  const { data: items } = await supabase
    .from('purchase_return_items')
    .select('*, product:products(name, sku)')
    .eq('purchase_return_id', id)

  const total = Number(ret.total_amount || 0)
  const applied = Number(ret.applied_amount || 0)
  const remaining = Math.max(total - applied, 0)

  return (
    <section style={{ maxWidth: 720 }}>
      <Link
        href="/procurement/returns"
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Returns
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>{ret.return_number}</h1>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          fontSize: 14,
        }}
      >
        <div>
          Supplier: <strong>{ret.supplier?.name || '-'}</strong>
        </div>
        <div>
          Reason: <strong>{ret.reason}</strong>
        </div>
        <div>
          Date: <strong>{parseDate(ret.returned_at)}</strong>
        </div>
        <div>
          PBF Credit Note: <strong>{ret.pbf_credit_note_number || '-'}</strong>
        </div>
        <div>
          Total: <strong>{total.toFixed(2)}</strong>
        </div>
        <div>
          Remaining credit: <strong>{remaining.toFixed(2)}</strong>
        </div>
        {ret.notes && (
          <div style={{ gridColumn: '1 / -1' }}>
            Notes: {ret.notes}
          </div>
        )}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Batch</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Unit Cost</th>
            <th style={thStyle}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((it: any) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle}>
                {it.product?.name || '-'} ({it.product?.sku || '-'})
              </td>
              <td style={tdStyle}>{it.batch_number}</td>
              <td style={tdStyle}>{parseDate(it.expiry_date)}</td>
              <td style={tdStyle}>{Number(it.qty_returned)}</td>
              <td style={tdStyle}>{Number(it.unit_cost).toFixed(2)}</td>
              <td style={tdStyle}>{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
}
