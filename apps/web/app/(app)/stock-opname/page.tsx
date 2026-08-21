import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
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

const statusVariant = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  APPROVED: 'default',
  CANCELLED: 'destructive',
} satisfies Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function StockOpnamePage() {
  const supabase = await createClient()
  const { data: opnames, error } = await supabase
    .from('stock_opnames')
    .select('*, stock_opname_items (id)')
    .order('created_at', { ascending: false })

  if (error) return <p className="text-sm text-destructive">Stock opname unavailable</p>

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Stock Opname</h1>
        <Button render={<Link href="/stock-opname/new" />}>New Opname</Button>
      </div>
      {!opnames || opnames.length === 0 ? (
        <EmptyState
          title="Belum ada sesi opname"
          description="Opname pertama menjadi dasar saldo awal kartu stok."
          action={<Button render={<Link href="/stock-opname/new" />}>Opname Baru</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Dibuat Pada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opnames.map((op: any) => {
                // SAFETY: op.status is always one of the opname status values from the query.
                const badgeVariant = statusVariant[op.status as keyof typeof statusVariant] || 'secondary'
                return (
                <TableRow key={op.id} className="h-10">
                  <TableCell>
                    <Link href={`/stock-opname/${op.id}`} className="text-sm text-primary hover:underline">
                      {op.opname_number}
                    </Link>
                  </TableCell>
                  <TableCell>{op.type}</TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant}>{op.status}</Badge>
                  </TableCell>
                  <TableCell>{(op.stock_opname_items || []).length}</TableCell>
                  <TableCell>{parseDate(op.created_at)}</TableCell>
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