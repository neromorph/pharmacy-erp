import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'
import { getUserRole } from '../../../../../utils/auth'
import { DestructionForm } from './destruction-form'

export default async function NewDestructionPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p className="text-sm text-destructive">Access denied. Owner or pharmacist (APJ) only.</p>
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
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/stock/destructions"
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          Back to Pemusnahan
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">New Destruction</h1>
        <p className="mt-1 text-sm text-slate-500">
          A destruction is a formal legal event. The BAP fields are required, and
          destroyed stock leaves the batch immediately.
        </p>
      </div>
      <DestructionForm products={products || []} batches={batches || []} />
    </section>
  )
}