import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'

const opnameReasons = ['DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC']

async function createStockOpname(formData: FormData) {
  'use server'
  const type = (formData.get('type') as string) || 'FULL_STORE'
  const opnameNumber = `SON-${Date.now()}`
  const batchIds = formData.getAll('batch_id') as string[]
  const physicalQtys = formData.getAll('physical_qty') as string[]
  const reasons = formData.getAll('reason') as string[]

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const { data: opname, error: hErr } = await supabase
    .from('stock_opnames')
    .insert([{ tenant_id: tenantId, opname_number: opnameNumber, type, status: 'DRAFT', created_by: user?.id }])
    .select()
    .single()
  if (hErr) {
    redirect('/stock-opname/new?error=Failed to create opname session')
    return
  }

  // Read current quantities for each batch, compute base variance.
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < batchIds.length; i++) {
    const batchId = batchIds[i]
    const { data: batch } = await supabase
      .from('product_batches')
      .select('product_id, current_qty')
      .eq('id', batchId)
      .single()
    if (!batch) continue
    const systemQty = Number(batch.current_qty)
    const physicalQty = Number(physicalQtys[i] || 0)
    rows.push({
      tenant_id: tenantId,
      opname_id: opname.id,
      product_id: batch.product_id,
      batch_id: batchId,
      system_qty_base: systemQty,
      physical_qty_base: physicalQty,
      variance_qty_base: systemQty - physicalQty,
      reason: reasons[i] || 'MISC',
    })
  }

  const { error: iErr } = await supabase.from('stock_opname_items').insert(rows)
  if (iErr) {
    redirect('/stock-opname/new?error=Failed to add items')
    return
  }

  redirect(`/stock-opname/${opname.id}`)
}

export default async function NewStockOpnamePage() {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from('product_batches')
    .select('id, batch_number, expiry_date, current_qty, products (name, sku)')
    .order('product_id', { ascending: true })

  if (!batches || batches.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No batches in stock to count.</p>
  }

  return (
    <section>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Stock Opname</h1>
      <form
        action={createStockOpname}
        style={{
          background: 'var(--card)',
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
          Opname type
          <select
            name="type"
            style={{
              display: 'block',
              marginTop: 4,
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 14,
              background: '#fff',
            }}
            defaultValue="FULL_STORE"
          >
            <option value="FULL_STORE">Full Store</option>
            <option value="RACK_BASED">Rack Based</option>
            <option value="AD_HOC_SINGLE">Ad Hoc Single</option>
          </select>
        </label>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Product</th>
              <th style={thStyle}>Batch</th>
              <th style={thStyle}>Expiry</th>
              <th style={thStyle}>System</th>
              <th style={thStyle}>Physical</th>
              <th style={thStyle}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b: any) => (
              <tr key={b.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>{b.products?.name || b.sku}</td>
                <td style={tdStyle}>{b.batch_number}</td>
                <td style={tdStyle}>{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : '-'}</td>
                <td style={tdStyle}>{Number(b.current_qty).toFixed(3)}</td>
                <td style={tdStyle}>
                  <input type="hidden" name="batch_id" value={b.id} />
                  <input
                    type="number"
                    step="0.001"
                    name="physical_qty"
                    style={inputStyle}
                    defaultValue={Number(b.current_qty)}
                  />
                </td>
                <td style={tdStyle}>
                  <select name="reason" style={inputStyle} defaultValue="MISC">
                    {opnameReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="submit"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            marginTop: 16,
          }}
        >
          Save Draft
        </button>
      </form>
    </section>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, background: '#fff' }
