import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { ReturnForm } from './return-form'

export default async function NewReturnPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!role || role === 'CASHIER') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. Owner, pharmacist, or inventory only.</p>
  }

  const [{ data: suppliers }, { data: products }, { data: batches }] = await Promise.all([
    supabase.from('suppliers').select('id, name').order('name', { ascending: true }),
    supabase.from('products').select('id, name, sku').order('name', { ascending: true }),
    supabase
      .from('product_batches')
      .select('id, product_id, batch_number, expiry_date, current_qty')
      .gt('current_qty', 0)
      .order('batch_number', { ascending: true }),
  ])

  return (
    <section style={{ maxWidth: 860 }}>
      <Link
        href="/procurement/returns"
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Returns
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Purchase Return</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        A return creates a supplier credit note. It does not change the original invoice.
      </p>
      <ReturnForm suppliers={suppliers || []} products={products || []} batches={batches || []} />
    </section>
  )
}
