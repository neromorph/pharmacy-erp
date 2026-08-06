import { createClient } from '../../utils/supabase/server'
import Link from 'next/link'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Suppliers (PBF)</h1>
      {!suppliers || suppliers.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No suppliers yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>PBF</th>
              <th style={thStyle}>License Number</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Payment Terms (days)</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s: any) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/suppliers/${s.id}`} style={{ color: 'var(--primary)' }}>
                    {s.name}
                  </Link>
                </td>
                <td style={tdStyle}>
                  {s.is_pbf ? (
                    <span style={badgeStyle('#0d9488')}>PBF</span>
                  ) : (
                    <span style={badgeStyle('#64748b')}>Non-PBF</span>
                  )}
                </td>
                <td style={tdStyle}>{s.pbf_license_number || '-'}</td>
                <td style={tdStyle}>{s.phone || '-'}</td>
                <td style={tdStyle}>{s.payment_terms_days}</td>
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