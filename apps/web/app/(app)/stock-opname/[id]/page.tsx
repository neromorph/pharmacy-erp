import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole, canApproveOpname } from '../../../../utils/auth'

const statusColors: Record<string, string> = {
  DRAFT: '#64748b',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#0d9488',
  CANCELLED: '#ef4444',
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

function badgeStyle(color: string): React.CSSProperties {
  return { background: color, color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }
}

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }

async function submitStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status !== 'DRAFT') redirect(`/stock-opname/${id}`)
  await supabase.from('stock_opnames').update({ status: 'PENDING_APPROVAL' }).eq('id', id)
  redirect(`/stock-opname/${id}`)
}

async function cancelStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status === 'APPROVED' || op.status === 'CANCELLED') redirect(`/stock-opname/${id}`)
  await supabase.from('stock_opnames').update({ status: 'CANCELLED' }).eq('id', id)
  redirect(`/stock-opname/${id}`)
}

async function approveStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!canApproveOpname(role)) redirect(`/stock-opname/${id}`)

  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status !== 'PENDING_APPROVAL') redirect(`/stock-opname/${id}`)

  // Apply counted quantity to each batch. Only changes stock on approval.
  const { data: items } = await supabase.from('stock_opname_items').select('batch_id, physical_qty_base').eq('opname_id', id)
  for (const item of items || []) {
    await supabase
      .from('product_batches')
      .update({ current_qty: item.physical_qty_base })
      .eq('id', item.batch_id)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase
    .from('stock_opnames')
    .update({ status: 'APPROVED', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', id)
  redirect(`/stock-opname/${id}`)
}

export default async function StockOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const { data: op } = await supabase
    .from('stock_opnames')
    .select('*')
    .eq('id', id)
    .single()
  const { data: items } = await supabase
    .from('stock_opname_items')
    .select('*, products (name, sku), product_batches (batch_number, expiry_date)')
    .eq('opname_id', id)

  if (!op) {
    return <p style={{ color: 'var(--danger)' }}>Stock opname not found</p>
  }

  return (
    <section>
      <Link href="/stock-opname" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Stock Opname
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ fontSize: 20, margin: '0' }}>{op.opname_number}</h1>
        <span style={badgeStyle(statusColors[op.status] || '#64748b')}>{op.status}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{op.type}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)' }}>
        Created: {parseDate(op.created_at)} • Approved: {op.approved_at ? parseDate(op.approved_at) : '-'}
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)', marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
            <th style={thStyle}>Product</th>
            <th style={thStyle}>Batch</th>
            <th style={thStyle}>Expiry</th>
            <th style={thStyle}>System</th>
            <th style={thStyle}>Physical</th>
            <th style={thStyle}>Variance</th>
            <th style={thStyle}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((it: any) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={tdStyle}>{it.products?.name || it.product_id}</td>
              <td style={tdStyle}>{it.product_batches?.batch_number || '-'}</td>
              <td style={tdStyle}>{it.product_batches?.expiry_date ? parseDate(it.product_batches.expiry_date) : '-'}</td>
              <td style={tdStyle}>{Number(it.system_qty_base).toFixed(3)}</td>
              <td style={tdStyle}>{Number(it.physical_qty_base).toFixed(3)}</td>
              <td style={tdStyle}>{Number(it.variance_qty_base).toFixed(3)}</td>
              <td style={tdStyle}>{it.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {op.status === 'DRAFT' && (
          <>
            <form action={submitStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <button type="submit" style={btnStyle('var(--primary)')}>Submit for Approval</button>
            </form>
            <form action={cancelStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <button type="submit" style={btnStyle('#ef4444')}>Cancel</button>
            </form>
          </>
        )}
        {op.status === 'PENDING_APPROVAL' && canApproveOpname(role) && (
          <>
            <form action={approveStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <button type="submit" style={btnStyle('var(--primary)')}>Approve</button>
            </form>
            <form action={cancelStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <button type="submit" style={btnStyle('#ef4444')}>Cancel</button>
            </form>
          </>
        )}
        {op.status === 'PENDING_APPROVAL' && !canApproveOpname(role) && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Waiting for owner or pharmacist approval.</p>
        )}
      </div>
    </section>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return { background: bg, color: '#fff', padding: '8px 16px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }
}