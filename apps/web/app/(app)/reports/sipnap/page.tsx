import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { parseSipnapV2Report, isSipnapV2Ready, checksToLines } from '../../../../lib/sipnap-v2'
import { DownloadButton } from './download-button'
import { HistoryTab, type ExportRow } from './history'

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

const inputStyle: React.CSSProperties = {
  width: 90,
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  borderRadius: 6,
  fontSize: 13,
  textDecoration: 'none',
  fontWeight: active ? 600 : 400,
  color: active ? '#fff' : 'var(--text-secondary)',
  background: active ? 'var(--primary)' : 'transparent',
  border: active ? 'none' : '1px solid var(--border)',
})

export default async function SipnapReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; tab?: string; page?: string }>
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
  const tab = params.tab === 'history' ? 'history' : 'generate'

  const tabBar = (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <Link href={`/reports/sipnap?tab=generate&month=${month}&year=${year}`} style={tabStyle(tab === 'generate')}>
        Generate Report
      </Link>
      <Link href={`/reports/sipnap?tab=history`} style={tabStyle(tab === 'history')}>
        History
      </Link>
    </div>
  )

  // History tab: newest-first stored snapshots, 25 per page.
  if (tab === 'history') {
    const page = Math.max(1, Number(params.page) || 1)
    const from = (page - 1) * 25
    const { data: exports } = await supabase
      .from('sipnap_exports')
      .select('id, report_month, report_year, generated_at, generated_by, transaction_count, product_count, file_hash')
      .order('generated_at', { ascending: false })
      .range(from, from + 24)

    return (
      <section style={{ maxWidth: 980 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>SIPNAP Report</h1>
        {tabBar}
        <HistoryTab exports={(exports || []) as ExportRow[]} />
        {page > 1 ? (
          <Link href={`/reports/sipnap?tab=history&page=${page - 1}`} style={{ color: 'var(--primary)', fontSize: 13 }}>
            ← Previous
          </Link>
        ) : null}
        {(exports || []).length === 25 ? (
          <Link href={`/reports/sipnap?tab=history&page=${page + 1}`} style={{ color: 'var(--primary)', fontSize: 13, marginLeft: 12 }}>
            Next →
          </Link>
        ) : null}
      </section>
    )
  }

  // Generate tab.
  const { data, error } = await supabase.rpc('get_sipnap_report', { p_month: month, p_year: year })
  if (error || !data) {
    return (
      <section style={{ maxWidth: 860 }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>SIPNAP Report</h1>
        {tabBar}
        <p style={{ color: 'var(--danger)' }}>Report failed: {String(error?.message || 'no data')}</p>
      </section>
    )
  }

  const report = parseSipnapV2Report(data)
  const ready = isSipnapV2Ready(report)
  const checkLines = checksToLines(report.checks)
  const totals = report.products.reduce(
    (acc, p) => ({
      pbf: acc.pbf + Number(p.pemasukan_dari_pbf || 0),
      saranaIn: acc.saranaIn + Number(p.pemasukan_dari_sarana || 0),
      resep: acc.resep + Number(p.pengeluaran_untuk_resep || 0),
      saranaOut: acc.saranaOut + Number(p.pengeluaran_untuk_sarana || 0),
      destroyed: acc.destroyed + Number(p.jumlah_dimusnahkan || 0),
    }),
    { pbf: 0, saranaIn: 0, resep: 0, saranaOut: 0, destroyed: 0 }
  )

  return (
    <section style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>SIPNAP Report</h1>
      {tabBar}

      <form method="GET" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input type="hidden" name="tab" value="generate" />
        <input type="number" name="month" min={1} max={12} defaultValue={month} style={inputStyle} />
        <input type="number" name="year" min={2020} max={2100} defaultValue={year} style={inputStyle} />
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
      ) : null}

      {report.checks.length > 0 ? (
        <div style={{ marginTop: report.missing.length > 0 ? 16 : 0 }}>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Hard-Block Checks</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {checkLines.map((line, i) => (
              <li key={i} style={{ color: '#ef4444', marginBottom: 4 }}>
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.missing.length === 0 && report.checks.length === 0 ? (
        <div>
          <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Summary</h2>
          <p style={{ margin: 0, fontSize: 14 }}>
            Pemasukan Dari PBF: <strong>{totals.pbf.toFixed(2)}</strong>
          </p>
          <p style={{ margin: 0, fontSize: 14 }}>
            Pemasukan Dari Sarana: <strong>{totals.saranaIn.toFixed(2)}</strong>
          </p>
          <p style={{ margin: 0, fontSize: 14 }}>
            Pengeluaran Untuk Resep: <strong>{totals.resep.toFixed(2)}</strong>
          </p>
          <p style={{ margin: 0, fontSize: 14 }}>
            Pengeluaran Untuk Sarana: <strong>{totals.saranaOut.toFixed(2)}</strong>
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 14 }}>
            Dimusnahkan: <strong>{totals.destroyed.toFixed(2)}</strong>
          </p>
          <DownloadButton report={report} />
        </div>
      ) : null}

      {!ready && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 16 }}>
          Export is disabled until all missing data and hard-block checks are resolved.
        </p>
      )}
    </section>
  )
}
