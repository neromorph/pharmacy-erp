import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'
import { getKartuStokRows } from './actions'
import { buildKartuStokRows, formatKartuStokMovement } from '../../lib/kartu-stok'

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }

function typeColor(type: string): string {
  switch (type) {
    case 'IN': return '#0d9488'
    case 'OUT': return '#ef4444'
    case 'ADJUSTMENT': return '#f59e0b'
    case 'VOID': return '#64748b'
    default: return '#64748b'
  }
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium', hour: '2-digit', minute: '2-digit' })
}

interface PageProps {
  searchParams: Promise<{ product_id?: string; date_from?: string; date_to?: string }>
}

export default async function KartuStokPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = {
    product_id: params.product_id,
    date_from: params.date_from,
    date_to: params.date_to,
  }

  const supabase = await createClient()

  // Check for approved opname anchor
  const { data: { user } } = await supabase.auth.getUser()
  let hasAnchor = false
  if (user) {
    const tenantId = user.app_metadata?.tenant_id as string | undefined
    if (tenantId) {
      const { data } = await supabase
        .from('stock_opnames')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'APPROVED')
        .order('approved_at', { ascending: true })
        .limit(1)
      hasAnchor = !!data
    }
  }

  // Empty state — no approved opname
  if (!hasAnchor) {
    return (
      <section>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Kartu Stok</h1>
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            No approved stock opname found for this store.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 24 }}>
            Run an initial stock opname to seed the opening balance.
          </p>
          <Link
            href="/stock-opname/new"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
              display: 'inline-block',
            }}
          >
            New Stock Opname
          </Link>
        </div>
      </section>
    )
  }

  // Load data
  const { rows: rawRows, hasAnchor: anchorOk } = await getKartuStokRows(filters)
  const rows = buildKartuStokRows(rawRows)

  // Load products for display names
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .order('name', { ascending: true })
  const productMap = new Map((products || []).map((p: any) => [p.id, p.name]))

  // Group rows by product_id
  const grouped: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!grouped[row.product_id]) grouped[row.product_id] = []
    grouped[row.product_id].push(row)
  }

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Kartu Stok</h1>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {rows.length} movement{rows.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Filters */}
      <form
        method="GET"
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          background: 'var(--card)',
          padding: 16,
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Product</label>
          <input
            type="text"
            name="product_id"
            defaultValue={filters.product_id ?? ''}
            placeholder="Product name or ID"
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 14,
              background: 'var(--surface)',
              minWidth: 200,
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date From</label>
          <input
            type="date"
            name="date_from"
            defaultValue={filters.date_from ?? ''}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 14,
              background: 'var(--surface)',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date To</label>
          <input
            type="date"
            name="date_to"
            defaultValue={filters.date_to ?? ''}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              fontSize: 14,
              background: 'var(--surface)',
            }}
          />
        </div>
        {/* TODO: regulatory_category filter — requires products.regulatory_category column (future task) */}
        <div>
          <button
            type="submit"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Filter
          </button>
        </div>
        {filters.product_id || filters.date_from || filters.date_to ? (
          <div>
            <a
              href="/kartu-stok"
              style={{
                color: 'var(--text-secondary)',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Clear
            </a>
          </div>
        ) : null}
      </form>

      {/* Table */}
      {rows.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No movements found for the selected filters.</p>
      ) : (
        <div style={{ background: 'var(--card)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {Object.entries(grouped).map(([productId, productRows]) => (
            <div key={productId} style={{ borderTop: '1px solid var(--border)' }}>
              {/* Product header */}
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--surface)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {productMap.get(productId) ?? productId}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {productRows.length} row{productRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Rows for this product */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface)' }}>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Batch</th>
                    <th style={thStyle}>Expiry</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((row, i) => (
                    <tr
                      key={`${row.source_id}-${i}`}
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      <td style={tdStyle}>{parseDate(row.occurred_at)}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            background: typeColor(row.type),
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 4,
                          }}
                        >
                          {formatKartuStokMovement(row.type)}
                        </span>
                      </td>
                      <td style={tdStyle}>{row.batch_number || '-'}</td>
                      <td style={tdStyle}>{row.expiry_date ?? '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {row.qty > 0 ? `+${row.qty}` : row.qty}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                        {row.balance.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}