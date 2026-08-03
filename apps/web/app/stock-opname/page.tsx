import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

const statusColors: Record<string, string> = {
  DRAFT: '#64748b',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#0d9488',
  CANCELLED: '#ef4444',
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

function badgeStyle(color: string): React.CSSProperties {
  return { background: color, color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }
}

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }

export default async function StockOpnamePage() {
  const supabase = await createClient()
  const { data: opnames, error } = await supabase
    .from('stock_opnames')
    .select('*, stock_opname_items (id)')
    .order('created_at', { ascending: false })

  if (error) return <p style={{ color: 'var(--danger)' }}>Stock opname unavailable</p>

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Stock Opname</h1>
        <Link
          href="/stock-opname/new"
          style={{ background: 'var(--primary)', color: '#fff', padding: '8px 16px', borderRadius: 6, textDecoration: 'none', fontSize: 14 }}
        >
          New Opname
        </Link>
      </div>
      {!opnames || opnames.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No stock opname sessions yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Number</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Items</th>
              <th style={thStyle}>Created At</th>
            </tr>
          </thead>
          <tbody>
            {opnames.map((op: any) => (
              <tr key={op.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/stock-opname/${op.id}`} style={{ color: 'var(--primary)' }}>
                    {op.opname_number}
                  </Link>
                </td>
                <td style={tdStyle}>{op.type}</td>
                <td style={tdStyle}>
                  <span style={badgeStyle(statusColors[op.status] || '#64748b')}>{op.status}</span>
                </td>
                <td style={tdStyle}>{(op.stock_opname_items || []).length}</td>
                <td style={tdStyle}>{parseDate(op.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}