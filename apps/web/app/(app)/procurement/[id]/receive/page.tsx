import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../../utils/supabase/server'

async function receiveGoods(formData: FormData) {
  'use server'
  const id = formData.get('purchase_order_id') as string
  const receiptNumber = formData.get('receipt_number') as string
  const invoiceNumber = formData.get('invoice_number') as string
  const purchaseOrderItemIds = formData.getAll('purchase_order_item_id') as string[]
  const productIds = formData.getAll('product_id') as string[]
  const batchNumbers = formData.getAll('batch_number') as string[]
  const expiryDates = formData.getAll('expiry_date') as string[]
  const qtys = formData.getAll('qty_received') as string[]
  const unitCosts = formData.getAll('unit_cost') as string[]

  if (!receiptNumber || !invoiceNumber || purchaseOrderItemIds.length === 0) {
    redirect(`/procurement/${id}/receive?error=Missing required fields`)
    return
  }

  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('tenant_id, status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'APPROVED') {
    redirect(`/procurement/${id}`)
    return
  }

  const { data: gr, error: gErr } = await supabase
    .from('goods_receipts')
    .insert([
      {
        tenant_id: po.tenant_id,
        purchase_order_id: id,
        receipt_number: receiptNumber,
        invoice_number: invoiceNumber,
        received_at: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (gErr) {
    redirect(`/procurement/${id}/receive?error=Failed to create goods receipt`)
    return
  }

  const receiptItems = purchaseOrderItemIds.map((poItemId, i) => ({
    tenant_id: po.tenant_id,
    goods_receipt_id: gr.id,
    purchase_order_item_id: poItemId,
    product_id: productIds[i],
    batch_number: batchNumbers[i],
    expiry_date: expiryDates[i],
    qty_received: Number(qtys[i] || 0),
    unit_cost: Number(unitCosts[i] || 0),
    line_total: Number(qtys[i] || 0) * Number(unitCosts[i] || 0),
  }))

  const batches = purchaseOrderItemIds.map((poItemId, i) => ({
    tenant_id: po.tenant_id,
    product_id: productIds[i],
    batch_number: batchNumbers[i],
    expiry_date: expiryDates[i],
    current_qty: Number(qtys[i] || 0),
  }))

  const { error: iErr } = await supabase.from('goods_receipt_items').insert(receiptItems)
  if (iErr) {
    redirect(`/procurement/${id}/receive?error=Failed to add receipt items`)
    return
  }

  const { error: bErr } = await supabase.from('product_batches').insert(batches)
  if (bErr) {
    redirect(`/procurement/${id}/receive?error=Failed to update stock`)
    return
  }

  const { error: uErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'RECEIVED', received_at: new Date().toISOString() })
    .eq('id', id)
  if (uErr) {
    redirect(`/procurement/${id}/receive?error=Failed to complete purchase order`)
    return
  }

  redirect(`/procurement/${id}`)
}

export default async function ReceiveGoodsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, suppliers (name)')
    .eq('id', id)
    .single()
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('*, products (name, sku)')
    .eq('purchase_order_id', id)

  if (!po || po.status !== 'APPROVED') {
    return (
      <section>
        <Link
          href="/procurement"
          style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
        >
          Back to Procurement
        </Link>
        <p style={{ color: 'var(--danger)' }}>Only an approved purchase order can be received</p>
        <Link href={`/procurement/${id}`} style={{ color: 'var(--primary)' }}>
          Back to purchase order
        </Link>
      </section>
    )
  }

  return (
    <section style={{ maxWidth: 720 }}>
      <Link
        href={`/procurement/${id}`}
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Purchase Order
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Receive Goods</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        {po.po_number} • Supplier: {po.suppliers?.name || '-'}
      </p>

      <form
        action={receiveGoods}
        style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      >
        <input type="hidden" name="purchase_order_id" value={po.id} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Receipt Number</label>
            <input name="receipt_number" required placeholder="GR-2026-0001" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Invoice Number</label>
            <input name="invoice_number" required placeholder="INV-2026-0001" style={inputStyle} />
          </div>
        </div>

        <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Items</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {(items || []).map((it: any) => (
            <div
              key={it.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                gap: 8,
                alignItems: 'end',
              }}
            >
              <input type="hidden" name="purchase_order_item_id" value={it.id} />
              <input type="hidden" name="product_id" value={it.product_id} />
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Product</label>
                <span style={{ fontSize: 14 }}>
                  {it.products?.name || '-'} ({it.products?.sku || '-'})
                </span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Batch</label>
                <input name="batch_number" required placeholder="Batch no" style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Expiry</label>
                <input name="expiry_date" type="date" required style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Qty</label>
                <input
                  name="qty_received"
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  placeholder={String(it.qty_ordered)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Unit Cost</label>
                <input
                  name="unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder={String(Number(it.unit_price).toFixed(2))}
                  style={inputStyle}
                />
              </div>
            </div>
          ))}
        </div>

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
          Receive Goods
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
