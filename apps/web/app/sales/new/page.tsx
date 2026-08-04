import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { requireOpenShift } from '../../shifts/actions'
import { ShiftRow } from '@pharmacy/domain'
import { CartBuilder } from './cart-builder'

// POS blocked when no shift is open.
async function PosBlock() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>No Open Shift</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 20px' }}>
        Open a shift before you can start a sale.
      </p>
      <Link
        href="/shifts/new"
        style={{
          background: 'var(--primary)',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: 6,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Open Shift
      </Link>
    </div>
  )
}

const miniTh: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 11,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
}

const miniTd: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 12,
}

function parseDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  // Hard block: require open shift before POS is accessible.
  let openShiftData: ShiftRow | null = null
  try {
    openShiftData = await requireOpenShift()
  } catch {
    return (
      <section style={{ maxWidth: 480 }}>
        <Link href="/sales" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
          Back to Sales
        </Link>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Sale</h1>
        <PosBlock />
      </section>
    )
  }

  // Non-null here: requireOpenShift throws or we returned above.
  const openShift = openShiftData as ShiftRow

  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, base_unit, allow_fractional, regulatory_category')
    .order('name', { ascending: true })
  const [doctorRes, patientRes] = await Promise.all([
    supabase.from('doctors').select('id, name, sip_number').order('name', { ascending: true }),
    supabase.from('patients').select('id, name, address').order('name', { ascending: true }),
  ])
  const { data: batches } = await supabase
    .from('product_batches')
    .select('product_id, batch_number, expiry_date, current_qty')
    .gt('current_qty', 0)

  const stockByProduct: Record<string, { batch_number: string; expiry_date: string | null; current_qty: number }[]> = {}
  for (const b of batches || []) {
    if (!stockByProduct[b.product_id]) stockByProduct[b.product_id] = []
    stockByProduct[b.product_id].push(b)
  }

  return (
    <section style={{ maxWidth: 860 }}>
      <Link href="/sales" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Sales
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>New Sale</h1>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Shift: {openShift.id.slice(0, 8)}… · Opened {parseDate(openShift.opened_at)}
        </span>
      </div>

      {error && (
        <p style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <CartBuilder
        products={products || []}
        doctors={doctorRes.data || []}
        patients={patientRes.data || []}
      />

      <h2 style={{ fontSize: 14, margin: '20px 0 8px' }}>Available stock (FEFO)</h2>
      {(products || []).length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No products yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={miniTh}>Product</th>
              <th style={miniTh}>Batch</th>
              <th style={miniTh}>Expiry</th>
              <th style={miniTh}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {(products || []).map((p: any) => {
              const stock = stockByProduct[p.id] || []
              return stock.length === 0 ? null : (
                stock.map((b) => (
                  <tr key={`${p.id}-${b.batch_number}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={miniTd}>{p.name}</td>
                    <td style={miniTd}>{b.batch_number}</td>
                    <td style={miniTd}>{b.expiry_date ? parseDate(b.expiry_date) : '-'}</td>
                    <td style={miniTd}>{b.current_qty}</td>
                  </tr>
                ))
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}