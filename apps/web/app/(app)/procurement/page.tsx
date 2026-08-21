import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { parseDate } from './status'
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

const statusBadge = {
  DRAFT: 'outline',
  PENDING_APPROVAL: 'secondary',
  APPROVED: 'default',
  RECEIVED: 'secondary',
  CANCELLED: 'destructive',
} satisfies Record<string, 'default' | 'destructive' | 'outline' | 'secondary'>

export default async function ProcurementPage() {
  const supabase = await createClient()
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('*, suppliers (name)')
    .order('created_at', { ascending: false })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Pengadaan</h1>
        <Button render={<Link href="/procurement/new" />}>PO Baru</Button>
      </div>
      {!pos || pos.length === 0 ? (
        <EmptyState
          title="Belum ada pesanan pembelian"
          description="Buat PO pertama, lalu setujui dan terima barangnya."
          action={<Button render={<Link href="/procurement/new" />}>Buat PO</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nomor PO</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dipesan Pada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pos.map((po: any) => {
                // SAFETY: po.status is always one of the PO status values from the query.
                const badgeVariant = statusBadge[po.status as keyof typeof statusBadge] || 'secondary'
                return (
                <TableRow key={po.id} className="h-10">
                  <TableCell>
                    <Link href={`/procurement/${po.id}`} className="text-primary hover:underline">
                      {po.po_number}
                    </Link>
                  </TableCell>
                  <TableCell>{po.suppliers?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant}>{po.status}</Badge>
                  </TableCell>
                  <TableCell>{parseDate(po.ordered_at || po.created_at)}</TableCell>
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
