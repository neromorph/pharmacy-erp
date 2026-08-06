import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'

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

export default async function DestructionsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. Owner or pharmacist (APJ) only.</p>
  }

  const { data: destructions } = await supabase
    .from('stock_destructions')
    .select('id, bap_number, bap_date, reason, witness_names, created_by, created_at')
    .order('created_at', { ascending: false })

  return (
    <section style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Pemusnahan</h1>
        <Link
          href="/stock/destructions/new"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          New Destruction
        </Link>
      </div>

      {(destructions || []).length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No destruction records yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>BAP Number</th>
              <th style={thStyle}>BAP Date</th>
              <th style={thStyle}>Reason</th>
              <th style={thStyle}>Witnesses</th>
              <th style={thStyle}>Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {(destructions || []).map((d: any) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/stock/destructions/${d.id}`} style={{ color: 'var(--primary)' }}>
                    {d.bap_number}
                  </Link>
                </td>
                <td style={tdStyle}>{parseDate(d.bap_date)}</td>
                <td style={tdStyle}>{d.reason}</td>
                <td style={tdStyle}>{d.witness_names}</td>
                <td style={tdStyle}>{d.created_by || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
