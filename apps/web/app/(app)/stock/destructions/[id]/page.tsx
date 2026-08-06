import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'
import { getUserRole } from '../../../../../utils/auth'

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
}

function parseDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function DestructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. Owner or pharmacist (APJ) only.</p>
  }

  const { data: destruction } = await supabase
    .from('stock_destructions')
    .select('*')
    .eq('id', id)
    .single()
  if (!destruction) return <p style={{ color: 'var(--danger)' }}>Destruction not found.</p>

  const { data: items } = await supabase
    .from('stock_destruction_items')
    .select('*, products (name, sku)')
    .eq('stock_destruction_id', id)

  return (
    <section style={{ maxWidth: 860 }}>
      <Link
        href="/stock/destructions"
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Pemusnahan
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>{destruction.bap_number}</h1>

      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: 14 }}>
          BAP Date: <strong>{parseDate(destruction.bap_date)}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          Reason: <strong>{destruction.reason}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          Witnesses: <strong>{destruction.witness_names}</strong>
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          Recorded By: <strong>{destruction.created_by || '-'}</strong>
        </p>
        {destruction.notes ? (
          <p style={{ margin: 0, fontSize: 14 }}>
            Notes: <strong>{destruction.notes}</strong>
          </p>
        ) : null}
      </div>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Items</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Batch</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>Qty Destroyed</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item: any) => (
            <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle}>
                {item.products?.name || '-'} ({item.products?.sku || '-'})
              </td>
              <td style={tdStyle}>{item.batch_number}</td>
              <td style={tdStyle}>{parseDate(item.expiry_date)}</td>
              <td style={tdStyle}>{item.qty_destroyed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
