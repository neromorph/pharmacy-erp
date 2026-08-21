import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { parseDate } from './status'
import { formatRupiah } from '@/lib/receipt'
import { EmptyState } from '@/components/ui/empty-state'
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
const statusVariant = {
  DRAFT: 'outline',
  PAID: 'default',
  VOID: 'destructive',
} satisfies Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>

export default async function SalesPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, sale_items (*)')
    .order('created_at', { ascending: false })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Kasir</h1>
        <Button render={<Link href="/sales/new" />}>Transaksi Baru</Button>
      </div>
      {!sales || sales.length === 0 ? (
        <EmptyState
          title="Belum ada transaksi penjualan"
          description="Buka shift kasir, lalu buat transaksi pertama."
          action={<Button render={<Link href="/sales/new" />}>Transaksi Baru</Button>}
        />
      ) : (
        <Table>
          <TableHeader className="sticky top-14 z-10 bg-slate-50">
            <TableRow>
              <TableHead>Nomor Transaksi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Dibayar</TableHead>
              <TableHead>Waktu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((s: any) => {
              // SAFETY: s.status is always one of the sale status values from the query.
              const badgeVariant = statusVariant[s.status as keyof typeof statusVariant] || 'secondary'
              return (
              <TableRow key={s.id} className="h-10">
                <TableCell>
                  <Link href={`/sales/${s.id}`} className="text-primary">
                    {s.sale_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={badgeVariant}>{s.status}</Badge>
                </TableCell>
                <TableCell>{s.sale_items?.length ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(Number(s.grand_total))}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(Number(s.paid_amount))}
                </TableCell>
                <TableCell>{parseDate(s.sold_at || s.created_at)}</TableCell>
              </TableRow>
            )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
