import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'
import { getUserRole } from '../../../../../utils/auth'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function parseDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function DestructionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p className="text-sm text-destructive">Access denied. Owner or pharmacist (APJ) only.</p>
  }

  const { data: destruction } = await supabase
    .from('stock_destructions')
    .select('*')
    .eq('id', id)
    .single()
  if (!destruction) return <p className="text-sm text-destructive">Destruction not found.</p>

  const { data: items } = await supabase
    .from('stock_destruction_items')
    .select('*, products (name, sku)')
    .eq('stock_destruction_id', id)

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/stock/destructions"
          className="mb-4 inline-block text-sm text-primary hover:underline"
        >
          Back to Pemusnahan
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">{destruction.bap_number}</h1>
      </div>

      <div className="grid gap-3 rounded-xl bg-card px-4 py-4 text-sm ring-1 ring-foreground/10 sm:grid-cols-2">
        <p className="m-0">
          BAP Date: <strong className="text-slate-900">{parseDate(destruction.bap_date)}</strong>
        </p>
        <p className="m-0">
          Reason: <strong className="text-slate-900">{destruction.reason}</strong>
        </p>
        <p className="m-0">
          Witnesses: <strong className="text-slate-900">{destruction.witness_names}</strong>
        </p>
        <p className="m-0">
          Recorded By: <strong className="text-slate-900">{destruction.created_by || '-'}</strong>
        </p>
        {destruction.notes ? (
          <p className="m-0">
            Notes: <strong className="text-slate-900">{destruction.notes}</strong>
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-base font-medium text-slate-900">Items</h2>
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead className="text-right">Jml Dimusnahkan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(items || []).map((item: any) => (
                <TableRow key={item.id} className="h-10">
                  <TableCell>
                    {item.products?.name || '-'} ({item.products?.sku || '-'})
                  </TableCell>
                  <TableCell>{item.batch_number}</TableCell>
                  <TableCell>{parseDate(item.expiry_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.qty_destroyed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}