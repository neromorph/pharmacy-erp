import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { statusColors, parseDate } from '../status'
import { getUserRole, canVoidSale } from '../../../utils/auth'
import { listOpenShift } from '../../shifts/actions'
import { perProductQuantities, sumEmbalase } from '../../../lib/compound'
import { updateSaleClinicalInfo } from './actions'

async function voidSaleAction(formData: FormData) {
  'use server'
  const id = formData.get('sale_id') as string
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!canVoidSale(role)) redirect(`/sales/${id}`)

  const { data: sale } = await supabase
    .from('sales')
    .select('status')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'PAID') redirect(`/sales/${id}`)

  // Restore batch quantities for all sale items.
  const { data: items } = await supabase
    .from('sale_items')
    .select('product_batch_id, qty_sold')
    .eq('sale_id', id)

  for (const item of items || []) {
    if (!item.product_batch_id) continue
    const { data: batch } = await supabase
      .from('product_batches')
      .select('current_qty')
      .eq('id', item.product_batch_id)
      .single()
    if (batch) {
      await supabase
        .from('product_batches')
        .update({ current_qty: Number(batch.current_qty) + Number(item.qty_sold) })
        .eq('id', item.product_batch_id)
    }
  }

  await supabase
    .from('sales')
    .update({ status: 'VOID' })
    .eq('id', id)
  redirect(`/sales/${id}`)
}

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

  // Hard block: a draft sale may only be paid inside the cashier's own open shift.
  const { data: openShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', user?.id)
    .eq('status', 'OPEN')
    .maybeSingle()
  if (!openShift || sale.shift_id !== openShift.id) {
    redirect(`/sales/${id}?error=No open shift for this sale`)
    return
  }

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', id)

  // FEFO allocation per product: oldest expiry first, then earliest created.
  // Parent compound rows (product_id null) never enter stock allocation.
  const perProduct = perProductQuantities(saleItems || [])

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

  // Aggregate per-parent embalase fees into the sale total (Q3 locked).
  const embalaseTotal = sumEmbalase(saleItems || [])

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
      embalase_amount: embalaseTotal,
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
  const userRole = await getUserRole(supabase)
  const openShift = await listOpenShift()
  const { data: sale } = await supabase
    .from('sales')
    .select(
      '*, sale_items (*, products (name, sku)), sale_payments (*), doctors (name, sip_number), patients (name, address)'
    )
    .eq('id', id)
    .single()

  const [doctorListRes, patientListRes] = await Promise.all([
    supabase.from('doctors').select('id, name, sip_number').order('name', { ascending: true }),
    supabase.from('patients').select('id, name, address').order('name', { ascending: true }),
  ])

  if (!sale) {
    return <p style={{ color: 'var(--danger)' }}>Sale not found</p>
  }

  // Shift gate: draft sale with no shift cannot be paid — keep read-only.
  const shiftMissing = sale.status === 'DRAFT' && !sale.shift_id

  // Pay only if a shift is open.
  const canPay = sale.status === 'DRAFT' && !!openShift

  return (
    <section>
      <Link href="/sales" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Sales
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0' }}>{sale.sale_number}</h1>
        <span style={badgeStyle(statusColors[sale.status] || '#64748b')}>{sale.status}</span>
        <span style={badgeStyle(sale.sale_type === 'RESEP' ? '#8b5cf6' : '#0d9488')}>{sale.sale_type}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>Sold at: {parseDate(sale.sold_at || sale.created_at)}</p>
      {sale.sale_type === 'RESEP' && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Doctor: {sale.doctors?.name || '-'}{sale.doctors?.sip_number ? ` (${sale.doctors.sip_number})` : ''} · Patient:{' '}
          {sale.patients?.name || '-'}
        </p>
      )}

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
            <tr key={it.id} style={{ borderTop: '1px solid var(--border)', background: it.parent_item_id ? '#f8fafc' : undefined }}>
              <td style={{ ...tdStyle, paddingLeft: it.parent_item_id ? 28 : 12 }}>
                {it.parent_item_id ? '↳ ' : ''}
                {it.item_name || it.products?.name || it.product_id}
              </td>
              <td style={tdStyle}>{it.batch_number || '-'}</td>
              <td style={tdStyle}>{it.expiry_date ? parseDate(it.expiry_date) : '-'}</td>
              <td style={tdStyle}>{it.qty_sold}</td>
              <td style={tdStyle}>
                {Number(it.unit_price).toFixed(2)}
                {it.embalase_amount && Number(it.embalase_amount) > 0 ? ` + emb ${Number(it.embalase_amount).toFixed(2)}` : ''}
              </td>
              <td style={tdStyle}>{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 14 }}>
          Subtotal: {Number(sale.subtotal).toFixed(2)}
          {Number(sale.embalase_amount || 0) > 0 && (
            <> • Emb: {Number(sale.embalase_amount).toFixed(2)}</>
          )}
          {Number(sale.tuslah_amount || 0) > 0 && (
            <> • Tuslah: {Number(sale.tuslah_amount).toFixed(2)}</>
          )}
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          Grand Total: <strong>{Number(sale.grand_total).toFixed(2)}</strong>
        </p>
        {sale.status === 'PAID' && (
          <p style={{ margin: 4, fontSize: 14, color: 'var(--text-secondary)' }}>
            Paid: {Number(sale.paid_amount).toFixed(2)} • Change: {Number(sale.change_amount).toFixed(2)}
          </p>
        )}
      </div>

      {sale.status === 'DRAFT' && canPay && (
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

      {(shiftMissing || (sale.status === 'DRAFT' && !canPay)) && (
        <div
          style={{
            marginTop: 16,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 14, color: '#ef4444' }}>
            Cannot pay: {shiftMissing ? 'this draft sale has no associated shift.' : 'no open shift.'}
          </span>
          <a
            href="/shifts/new"
            style={{
              color: 'var(--primary)',
              fontSize: 13,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Open Shift →
          </a>
        </div>
      )}

      {sale.status === 'PAID' && (
        <div style={{ marginTop: 16 }}>
          <Link
            href={`/receipts/${sale.id}`}
            style={{
              display: 'inline-block',
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Cetak Struk
          </Link>
        </div>
      )}

      {sale.status === 'PAID' && sale.sale_type === 'RESEP' && canVoidSale(userRole) && (
        <form
          action={updateSaleClinicalInfo}
          style={{
            background: 'var(--card)',
            padding: 16,
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginTop: 16,
            maxWidth: 480,
          }}
        >
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Edit Prescription Info</h3>
          <input type="hidden" name="sale_id" value={sale.id} />
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Doctor</label>
            <select name="doctor_id" defaultValue={sale.doctor_id || ''} style={inputStyle}>
              <option value="">-</option>
              {(doctorListRes.data || []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.sip_number ? ` (${d.sip_number})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Patient</label>
            <select name="patient_id" defaultValue={sale.patient_id || ''} style={inputStyle}>
              <option value="">-</option>
              {(patientListRes.data || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.address ? ` (${p.address})` : ''}
                </option>
              ))}
            </select>
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
            Save
          </button>
        </form>
      )}

      {sale.status === 'PAID' && canVoidSale(userRole) && (
        <form action={voidSaleAction} style={{ marginTop: 16 }}>
          <input type="hidden" name="sale_id" value={sale.id} />
          <button
            type="submit"
            style={{
              background: 'var(--danger, #ef4444)',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Void Sale
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