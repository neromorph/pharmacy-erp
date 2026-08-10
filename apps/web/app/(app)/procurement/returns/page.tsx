import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
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

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function ReturnsListPage() {
  const supabase = await createClient()
  const { data: returns, error } = await supabase
    .from('purchase_returns')
    .select('id, return_number, reason, returned_at, total_amount, applied_amount, supplier:suppliers(name)')
    .order('returned_at', { ascending: false })

  if (error) return <p className="text-sm text-destructive">Retur tidak tersedia</p>

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Retur Pembelian</h1>
        <Button render={<Link href="/procurement/returns/new" />}>Retur Baru</Button>
      </div>
      {!returns || returns.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada retur</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nomor Retur</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Diaplikasikan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r: any) => {
                const applied = Number(r.applied_amount || 0)
                const total = Number(r.total_amount || 0)
                const status = applied >= total && total > 0 ? 'APPLIED' : 'OPEN'
                return (
                  <TableRow key={r.id} className="h-10">
                    <TableCell>
                      <Link href={`/procurement/returns/${r.id}`} className="text-primary hover:underline">
                        {r.return_number}
                      </Link>
                    </TableCell>
                    <TableCell>{r.supplier?.name || '-'}</TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>{parseDate(r.returned_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">{total.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{applied.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={status === 'APPLIED' ? 'default' : 'secondary'}>{status}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
