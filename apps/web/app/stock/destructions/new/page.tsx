import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { DestructionForm } from './destruction-form'

export default async function NewDestructionPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. Owner or pharmacist (APJ) only.</p>
  }

  const [{ data: products }, { data: batches }] = await Promise.all([
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
        href="/stock/destructions"
        style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}
      >
        Back to Pemusnahan
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>New Destruction</h1>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>
        A destruction is a formal legal event. The BAP fields are required, and
        destroyed stock leaves the batch immediately.
      </p>
      <DestructionForm products={products || []} batches={batches || []} />
    </section>
  )
}
