import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { statusColors, parseDate } from './status'

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items (*)')
    .order('created_at', { ascending: false })

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Sales</h1>
        <Link
          href="/sales/new"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          New Sale
        </Link>
      </div>
      {!sales || sales.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No sales yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Sale Number</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Items</th>
              <th style={thStyle}>Grand Total</th>
              <th style={thStyle}>Paid</th>
              <th style={thStyle}>Sold At</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s: any) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/sales/${s.id}`} style={{ color: 'var(--primary)' }}>
                    {s.sale_number}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <span style={badgeStyle(statusColors[s.status] || '#64748b')}>{s.status}</span>
                </td>
                <td style={tdStyle}>{s.sale_items?.length ?? 0}</td>
                <td style={tdStyle}>{Number(s.grand_total).toFixed(2)}</td>
                <td style={tdStyle}>{Number(s.paid_amount).toFixed(2)}</td>
                <td style={tdStyle}>{parseDate(s.sold_at || s.created_at)}</td>
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