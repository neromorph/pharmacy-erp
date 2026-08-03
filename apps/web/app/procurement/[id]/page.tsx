import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { statusColors, parseDate } from '../status'

async function submitPurchaseOrder(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'DRAFT') return redirect(`/procurement/${id}`)
  await supabase
    .from('purchase_orders')
    .update({ status: 'PENDING_APPROVAL' })
    .eq('id', id)
  redirect(`/procurement/${id}`)
}

async function approvePurchaseOrder(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'PENDING_APPROVAL') {
    redirect(`/procurement/${id}`)
    return
  }
  await supabase
    .from('purchase_orders')
    .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
    .eq('id', id)
  redirect(`/procurement/${id}`)
}

export default async function PurchaseOrderDetailPage({
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

  if (!po) {
    return <p style={{ color: 'var(--danger)' }}>Purchase order not found</p>
  }

  return (
    <section>
      <Link
        href="/procurement"
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Procurement
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0' }}>{po.po_number}</h1>
        <span style={badgeStyle(statusColors[po.status] || '#64748b')}>{po.status}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>
        Supplier: {po.suppliers?.name || '-'} • Ordered: {parseDate(po.ordered_at || po.created_at)}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>SKU</th>
            <th style={thStyle}>Qty</th>
            <th style={thStyle}>Unit Price</th>
            <th style={thStyle}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((it: any) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle}>{it.products?.name || '-'}</td>
              <td style={tdStyle}>{it.products?.sku || '-'}</td>
              <td style={tdStyle}>{it.qty_ordered}</td>
              <td style={tdStyle}>{Number(it.unit_price).toFixed(2)}</td>
              <td style={tdStyle}>{Number(it.line_total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {po.status === 'DRAFT' && (
        <form style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={po.id} />
          <button
            formAction={submitPurchaseOrder}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Submit for Approval
          </button>
        </form>
      )}
      {po.status === 'PENDING_APPROVAL' && (
        <form style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={po.id} />
          <button
            formAction={approvePurchaseOrder}
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 16px',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Approve
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