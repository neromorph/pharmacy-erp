import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'

async function createDraftSale(formData: FormData) {
  'use server'
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

export default async function NewSalePage() {
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
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Sale</h1>

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