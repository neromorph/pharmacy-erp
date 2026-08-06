import Link from 'next/link'
import { createClient } from '../../../../../utils/supabase/server'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: ret } = await supabase
    .from('purchase_returns')
    .select('*, supplier:suppliers(name)')
    .eq('id', id)
    .single()

  if (!ret) return <p className="text-sm text-slate-500">Return not found</p>

  const { data: items } = await supabase
    .from('purchase_return_items')
    .select('*, product:products(name, sku)')
    .eq('purchase_return_id', id)

  const total = Number(ret.total_amount || 0)
  const applied = Number(ret.applied_amount || 0)
  const remaining = Math.max(total - applied, 0)

  return (
    <section className="space-y-6">
      <div>
        <Link href="/procurement/returns" className="text-sm text-primary hover:underline">
          Back to Returns
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">{ret.return_number}</h1>
      </div>

      <div className="grid max-w-2xl grid-cols-1 gap-x-4 gap-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:grid-cols-2">
        <div>
          Supplier: <strong>{ret.supplier?.name || '-'}</strong>
        </div>
        <div>
          Reason: <strong>{ret.reason}</strong>
        </div>
        <div>
          Date: <strong>{parseDate(ret.returned_at)}</strong>
        </div>
        <div>
          PBF Credit Note: <strong>{ret.pbf_credit_note_number || '-'}</strong>
        </div>
        <div>
          Total: <strong className="tabular-nums">{total.toFixed(2)}</strong>
        </div>
        <div>
          Remaining credit: <strong className="tabular-nums">{remaining.toFixed(2)}</strong>
        </div>
        {ret.notes && (
          <div className="sm:col-span-2">
            Notes: {ret.notes}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items || []).map((it: any) => (
              <TableRow key={it.id} className="h-10">
                <TableCell>
                  {it.product?.name || '-'} ({it.product?.sku || '-'})
                </TableCell>
                <TableCell>{it.batch_number}</TableCell>
                <TableCell>{parseDate(it.expiry_date)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.qty_returned)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.unit_cost).toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.line_total).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
