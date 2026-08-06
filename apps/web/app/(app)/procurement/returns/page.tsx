import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function ReturnsListPage() {
  const supabase = await createClient()
  const { data: returns, error } = await supabase
    .from('purchase_returns')
    .select('id, return_number, reason, returned_at, total_amount, applied_amount, supplier:suppliers(name)')
    .order('returned_at', { ascending: false })

  if (error) return <p style={{ color: 'var(--danger)' }}>Returns unavailable</p>

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Purchase Returns</h1>
        <Link
          href="/procurement/returns/new"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
          }}
        >
          New Return
        </Link>
      </div>
      {!returns || returns.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No returns yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Return Number</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Applied</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r: any) => {
              const applied = Number(r.applied_amount || 0)
              const total = Number(r.total_amount || 0)
              const status = applied >= total && total > 0 ? 'APPLIED' : 'OPEN'
              return (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <Link href={`/procurement/returns/${r.id}`} style={{ color: 'var(--primary)' }}>
                      {r.return_number}
                    </Link>
                  </td>
                  <td style={tdStyle}>{r.supplier?.name || '-'}</td>
                  <td style={tdStyle}>{r.reason}</td>
                  <td style={tdStyle}>{parseDate(r.returned_at)}</td>
                  <td style={tdStyle}>{total.toFixed(2)}</td>
                  <td style={tdStyle}>{applied.toFixed(2)}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(status === 'APPLIED' ? '#0d9488' : '#f59e0b')}>{status}</span>
                  </td>
                </tr>
              )
            })}
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
