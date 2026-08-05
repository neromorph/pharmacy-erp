import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { parseSipnapReport } from '../../../lib/sipnap'
import { DownloadButton } from './download-button'

export default async function SipnapReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>
}) {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. OWNER or PHARMACIST only.</p>
  }

  const params = await searchParams
  const now = new Date()
  const month = Number(params.month) || now.getMonth() + 1
  const year = Number(params.year) || now.getFullYear()

  const { data, error } = await supabase.rpc('get_sipnap_report', { p_month: month, p_year: year })
  if (error || !data) {
    return <p style={{ color: 'var(--danger)' }}>Report failed: {String(error?.message || 'no data')}</p>
  }

  const report = parseSipnapReport(data)

  return (
    <section style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>SIPNAP Report</h1>
      <form method="GET" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="number"
          name="month"
          min={1}
          max={12}
          defaultValue={month}
          style={inputStyle}
        />
        <input
          type="number"
          name="year"
          min={2020}
          max={2100}
          defaultValue={year}
          style={inputStyle}
        />
        <button
          type="submit"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Load
        </button>
      </form>

      {report.missing.length > 0 ? (
        <div>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Missing Data</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
            Fix these transactions before export is enabled.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={thStyle}>Invoice</th>
                <th style={thStyle}>Missing fields</th>
              </tr>
            </thead>
            <tbody>
              {report.missing.map((m) => (
                <tr key={m.sale_id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <Link href={`/sales/${m.sale_id}`} style={{ color: 'var(--primary)' }}>
                      {m.sale_number}
                    </Link>
                  </td>
                  <td style={tdStyle}>{m.missing_fields.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Summary</h2>
          <p style={{ margin: 0, fontSize: 14 }}>Total Items: {report.transactions.length}</p>
          <p style={{ margin: 0, fontSize: 14 }}>
            Total In: {report.products.reduce((sum, p) => sum + Number(p.pemasukan), 0)}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 14 }}>
            Total Out: {report.products.reduce((sum, p) => sum + Number(p.pengeluaran), 0)}
          </p>
          <DownloadButton report={report} />
        </div>
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

const inputStyle: React.CSSProperties = {
  width: 90,
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
}
