import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { requireOpenShift } from '../../shifts/actions'
import { ShiftRow } from '@pharmacy/domain'

async function createDraftSale(formData: FormData) {
  'use server'
  // Hard block: POS is only reachable with an open shift.
  const openShift = await requireOpenShift()

  const productIds = formData.getAll('product_id') as string[]
  const qtys = formData.getAll('qty_sold') as string[]
  const prices = formData.getAll('unit_price') as string[]

  if (productIds.length === 0) {
    redirect('/sales/new?error=Add at least one item')
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const subtotal = productIds.reduce((sum, _p, i) => {
    return sum + Number(qtys[i] || 0) * Number(prices[i] || 0)
  }, 0)

  const { data: sale, error: hErr } = await supabase
    .from('sales')
    .insert([
      {
        tenant_id: tenantId,
        sale_number: 'SALE-' + Date.now(),
        status: 'DRAFT',
        subtotal,
        grand_total: subtotal,
        cashier_id: user?.id,
        shift_id: openShift.id,
      },
    ])
    .select()
    .single()

  if (hErr) {
    redirect('/sales/new?error=Failed to create sale')
    return
  }

  const rows = productIds.map((productId, i) => ({
    tenant_id: tenantId,
    sale_id: sale.id,
    product_id: productId,
    qty_sold: Number(qtys[i] || 0),
    unit_price: Number(prices[i] || 0),
    line_total: Number(qtys[i] || 0) * Number(prices[i] || 0),
  }))

  const { error: iErr } = await supabase.from('sale_items').insert(rows)
  if (iErr) {
    redirect('/sales/new?error=Failed to add items')
    return
  }

  redirect(`/sales/${sale.id}`)
}

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
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
    .select('id, name, sku')
    .order('name', { ascending: true })
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
    <section style={{ maxWidth: 760 }}>
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

      <form
        action={createDraftSale}
        style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      >
        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Items</h2>
        <div id="items" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2.4fr 1fr 1fr', gap: 8 }}>
            <select name="product_id" required style={inputStyle}>
              <option value="">Product</option>
              {(products || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <input name="qty_sold" type="number" step="0.001" min="0" required placeholder="Qty" style={inputStyle} />
            <input name="unit_price" type="number" step="0.01" min="0" required placeholder="Price" style={inputStyle} />
          </div>
        </div>

        <h2 style={{ fontSize: 14, margin: '16px 0 8px' }}>Available stock (FEFO)</h2>
        {(products || []).length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No products yet</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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

        <button
          type="submit"
          style={{
            marginTop: 16,
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Create Draft Sale
        </button>
      </form>
    </section>
  )
}