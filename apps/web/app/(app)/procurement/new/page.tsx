import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'

async function createPurchaseOrder(formData: FormData) {
  'use server'
  const supplierId = formData.get('supplier_id') as string
  const poNumber = formData.get('po_number') as string
  const productIds = formData.getAll('product_id') as string[]
  const qtys = formData.getAll('qty_ordered') as string[]
  const prices = formData.getAll('unit_price') as string[]

  if (!supplierId || !poNumber || productIds.length === 0) {
    redirect('/procurement/new?error=Missing required fields')
    return
  }

  const supabase = await createClient()
  const { data: po, error: hErr } = await supabase
    .from('purchase_orders')
    .insert([
      {
        supplier_id: supplierId,
        po_number: poNumber,
        status: 'DRAFT',
      },
    ])
    .select()
    .single()

  if (hErr) {
    redirect('/procurement/new?error=Failed to create PO')
    return
  }

  const rows = productIds.map((productId, i) => ({
    purchase_order_id: po.id,
    product_id: productId,
    qty_ordered: Number(qtys[i] || 0),
    unit_price: Number(prices[i] || 0),
    line_total: Number(qtys[i] || 0) * Number(prices[i] || 0),
  }))

  const { error: iErr } = await supabase.from('purchase_order_items').insert(rows)
  if (iErr) {
    redirect(`/procurement/new?error=Failed to add items`)
    return
  }

  redirect(`/procurement/${po.id}`)
}

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name', { ascending: true })
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku')
    .order('name', { ascending: true })

  return (
    <section style={{ maxWidth: 720 }}>
      <Link href="/procurement" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Procurement
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Purchase Order</h1>

      <form
        action={createPurchaseOrder}
        style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
      >
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PO Number</label>
          <input
            name="po_number"
            required
            style={inputStyle}
            placeholder="PO-2026-0001"
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Supplier</label>
          <select name="supplier_id" required style={inputStyle}>
            <option value="">Select supplier</option>
            {(suppliers || []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <h2 style={{ fontSize: 14, margin: '16px 0 8px' }}>Items</h2>
        <div id="items" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
            <select name="product_id" required style={inputStyle}>
              <option value="">Product</option>
              {(products || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <input name="qty_ordered" type="number" step="0.001" min="0" required placeholder="Qty" style={inputStyle} />
            <input name="unit_price" type="number" step="0.01" min="0" required placeholder="Price" style={inputStyle} />
          </div>
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
          Create PO (Draft)
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