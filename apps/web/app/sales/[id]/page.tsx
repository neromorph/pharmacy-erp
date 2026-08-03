import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { statusColors, parseDate } from '../status'

const paymentMethods = ['CASH', 'CARD', 'TRANSFER', 'QRIS']

async function paySale(formData: FormData) {
  'use server'
  const id = formData.get('sale_id') as string
  const paymentMethod = formData.get('payment_method') as string
  const paidAmount = Number(formData.get('paid_amount') || 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const { data: sale } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'DRAFT') {
    redirect(`/sales/${id}`)
    return
  }

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', id)

  // FEFO allocation per product: oldest expiry first, then earliest created.
  const perProduct = new Map<string, number>()
  for (const item of saleItems || []) {
    const key = item.product_id
    perProduct.set(key, (perProduct.get(key) || 0) + Number(item.qty_sold))
  }

  const allocated: Record<string, { product_batch_id: string; qty: number }[]> = {}
  for (const [productId, qtyNeeded] of perProduct.entries()) {
    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, current_qty')
      .eq('product_id', productId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true })
      .order('created_at', { ascending: true })

    const allocations: { product_batch_id: string; qty: number }[] = []
    let remaining = qtyNeeded
    for (const batch of batches || []) {
      if (remaining <= 0) break
      const take = Math.min(Number(batch.current_qty), remaining)
      allocations.push({ product_batch_id: batch.id, qty: take })
      remaining -= take
    }
    if (remaining > 0) {
      redirect(`/sales/${id}?error=Insufficient stock`)
      return
    }
    allocated[productId] = allocations
  }

  // Backfill batch info on the product's sale_items rows.
  for (const [productId, allocs] of Object.entries(allocated)) {
    if (allocs.length === 0) continue
    const first = allocs[0]
    const { data: batch } = await supabase
      .from('product_batches')
      .select('batch_number, expiry_date')
      .eq('id', first.product_batch_id)
      .single()
    await supabase
      .from('sale_items')
      .update({
        product_batch_id: first.product_batch_id,
        batch_number: batch?.batch_number,
        expiry_date: batch?.expiry_date,
      })
      .eq('sale_id', id)
      .eq('product_id', productId)
  }

  // Deduct batch quantities.
  for (const allocs of Object.values(allocated)) {
    for (const alloc of allocs) {
      const { data: batch } = await supabase
        .from('product_batches')
        .select('current_qty')
        .eq('id', alloc.product_batch_id)
        .single()
      if (batch) {
        const newQty = Number(batch.current_qty) - alloc.qty
        await supabase
          .from('product_batches')
          .update({ current_qty: newQty })
          .eq('id', alloc.product_batch_id)
      }
    }
  }

  const grandTotal = Number(sale.grand_total)
  const changeAmount = paidAmount - grandTotal

  await supabase.from('sale_payments').insert([
    {
      tenant_id: tenantId,
      sale_id: id,
      payment_method: paymentMethod,
      amount: paidAmount,
    },
  ])

  await supabase
    .from('sales')
    .update({
      status: 'PAID',
      paid_amount: paidAmount,
      change_amount: changeAmount,
      sold_at: new Date().toISOString(),
    })
    .eq('id', id)

  redirect(`/sales/${id}`)
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: sale } = await supabase
    .from('sales')
    .select('*, sale_items (*, products (name, sku)), sale_payments (*)')
    .eq('id', id)
    .single()

  if (!sale) {
    return <p style={{ color: 'var(--danger)' }}>Sale not found</p>
  }

  return (
    <section>
      <Link href="/sales" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Sales
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0' }}>{sale.sale_number}</h1>
        <span style={badgeStyle(statusColors[sale.status] || '#64748b')}>{sale.status}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>Sold at: {parseDate(sale.sold_at || sale.created_at)}</p>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Batch</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Unit Price</th>
            <th style={thStyle}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {(sale.sale_items || []).map((it: any) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle}>{it.products?.name || it.product_id}</td>
              <td style={tdStyle}>{it.batch_number || '-'}</td>
              <td style={tdStyle}>{it.expiry_date ? parseDate(it.expiry_date) : '-'}</td>
              <td style={tdStyle}>{it.qty_sold}</td>
              <td style={tdStyle}>{Number(it.unit_price).toFixed(2)}</td>
              <td style={tdStyle}>{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          Grand Total: <strong>{Number(sale.grand_total).toFixed(2)}</strong>
        </p>
        {sale.status === 'PAID' && (
          <p style={{ margin: 4, fontSize: 14, color: 'var(--text-secondary)' }}>
            Paid: {Number(sale.paid_amount).toFixed(2)} • Change: {Number(sale.change_amount).toFixed(2)}
          </p>
        )}
      </div>

      {sale.status === 'DRAFT' && (
        <form
          action={paySale}
          style={{
            background: 'var(--card)',
            padding: 16,
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginTop: 16,
            maxWidth: 360,
          }}
        >
          <input type="hidden" name="sale_id" value={sale.id} />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Payment method</label>
            <select name="payment_method" required style={inputStyle}>
              {paymentMethods.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Paid amount</label>
            <input name="paid_amount" type="number" step="0.01" min="0" required style={inputStyle} />
          </div>
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
            Complete Sale (Paid)
          </button>
        </form>
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
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
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