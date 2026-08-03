import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'
import { statusColors, parseDate } from './status'

export default async function ProcurementPage() {
  const supabase = await createClient()
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('*, suppliers (name)')
    .order('created_at', { ascending: false })

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Procurement</h1>
        <Link
          href="/procurement/new"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          New PO
        </Link>
      </div>
      {!pos || pos.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No purchase orders yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>PO Number</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Ordered At</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po: any) => (
              <tr key={po.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/procurement/${po.id}`} style={{ color: 'var(--primary)' }}>
                    {po.po_number}
                  </Link>
                </td>
                <td style={tdStyle}>{po.suppliers?.name || '-'}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle(statusColors[po.status] || '#64748b')}>{po.status}</span>
                </td>
                <td style={tdStyle}>{parseDate(po.ordered_at || po.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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

function badgeStyle(color: string): React.CSSProperties {
  return {
    background: color,
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
  }
}