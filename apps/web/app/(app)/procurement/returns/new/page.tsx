import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'
import { getUserRole } from '../../../../../utils/auth'
import { ReturnForm } from './return-form'

export default async function NewReturnPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!role || role === 'CASHIER') {
    return <p className="text-sm text-destructive">Akses ditolak. Hanya Owner, Apoteker, atau staf Inventori.</p>
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
    <section className="space-y-6">
      <div>
        <Link href="/procurement/returns" className="text-sm text-primary hover:underline">
          Kembali ke Retur
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Retur Pembelian Baru</h1>
        <p className="mt-1 text-sm text-slate-500">
          Retur membuat nota kredit pemasok. Nota asli tidak berubah.
        </p>
      </div>
      <ReturnForm suppliers={suppliers || []} products={products || []} batches={batches || []} />
    </section>
  )
}
