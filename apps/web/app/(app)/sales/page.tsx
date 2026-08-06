import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { parseDate } from './status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Status badge variants follow the approved pill mapping:
// DRAFT outline, PAID default (teal), VOID destructive.
const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'outline',
  PAID: 'default',
  VOID: 'destructive',
}

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items (*)')
    .order('created_at', { ascending: false })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Sales</h1>
        <Button render={<Link href="/sales/new" />}>New Sale</Button>
      </div>
      {!sales || sales.length === 0 ? (
        <p className="text-sm text-slate-500">No sales yet</p>
      ) : (
        <Table>
          <TableHeader className="sticky top-14 z-10 bg-slate-50">
            <TableRow>
              <TableHead>Sale Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Sold At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s: any) => (
              <TableRow key={s.id} className="h-10">
                <TableCell>
                  <Link href={`/sales/${s.id}`} className="text-primary">
                    {s.sale_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[s.status] || 'secondary'}>{s.status}</Badge>
                </TableCell>
                <TableCell>{s.sale_items?.length ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(s.grand_total).toFixed(2)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(s.paid_amount).toFixed(2)}
                </TableCell>
                <TableCell>{parseDate(s.sold_at || s.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
