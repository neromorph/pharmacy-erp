import { createClient } from '../../../../utils/supabase/server'
import { getPayableStatus } from '../../../../lib/accounts-payable'
import { getAgingBucket, type AgingBucket } from '../../../../lib/purchase-returns'
import { AgingCards, type BucketSummary } from './aging-cards'
import { AgingCsvButton } from './aging-csv-button'
import { PayoutDialog } from './payout-dialog'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const statusBadge: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  UNPAID: 'outline',
  PARTIAL: 'secondary',
  PAID: 'default',
  OVERDUE: 'destructive',
}

const buckets: AgingBucket[] = ['CURRENT', '1-30', '31-60', '61-90', '90+']

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function PayablesPage() {
  const supabase = await createClient()
  const [payablesRes, returnsRes] = await Promise.all([
    supabase
      .from('accounts_payables')
      .select(
        'id, invoice_number, due_date, receipt_total_amount, paid_amount, remaining_amount, supplier_id, supplier:suppliers(name)'
      )
      .order('due_date', { ascending: true }),
    supabase.from('purchase_returns').select('supplier_id, total_amount, applied_amount'),
  ])

  if (payablesRes.error) return <p className="text-sm text-destructive">Hutang dagang tidak tersedia</p>

  const rows = payablesRes.data || []
  const now = new Date().toISOString()

  // Unapplied credit per supplier (total minus applied across its returns).
  const unappliedBySupplier = new Map<string, number>()
  for (const r of returnsRes.data || []) {
    const current = unappliedBySupplier.get(r.supplier_id) || 0
    unappliedBySupplier.set(r.supplier_id, current + (Number(r.total_amount || 0) - Number(r.applied_amount || 0)))
  }

  const summaries: BucketSummary[] = buckets.map((bucket) => ({
    bucket,
    count: 0,
    total: 0,
  }))
  const byBucket = new Map(buckets.map((b) => [b, summaries.find((s) => s.bucket === b)!]))

  const csvRows = rows
    .filter((row: any) => Number(row.remaining_amount) > 0)
    .map((row: any) => {
      const bucket = getAgingBucket(row.due_date, now)
      const summary = byBucket.get(bucket)!
      summary.count += 1
      summary.total += Number(row.remaining_amount)
      return {
        supplier: row.supplier?.name || '-',
        invoice: row.invoice_number,
        dueDate: row.due_date,
        total: Number(row.receipt_total_amount),
        paid: Number(row.paid_amount),
        remaining: Number(row.remaining_amount),
        status: getPayableStatus({
          paidAmount: Number(row.paid_amount),
          remainingAmount: Number(row.remaining_amount),
          dueDate: row.due_date,
          now,
        }),
        bucket,
      }
    })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Hutang Dagang</h1>
        {csvRows.length > 0 && <AgingCsvButton rows={csvRows} />}
      </div>
      <AgingCards summaries={summaries} />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada hutang dagang</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Faktur</TableHead>
                <TableHead>Pemasok</TableHead>
                <TableHead>Jatuh Tempo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Dibayar</TableHead>
                <TableHead className="text-right">Sisa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pembayaran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row: any) => {
                const status = getPayableStatus({
                  paidAmount: Number(row.paid_amount),
                  remainingAmount: Number(row.remaining_amount),
                  dueDate: row.due_date,
                  now,
                })
                const paidOut = status === 'PAID' || Number(row.remaining_amount) <= 0
                const unappliedCredit = unappliedBySupplier.get(row.supplier_id) || 0
                return (
                  <TableRow key={row.id} className="h-10">
                    <TableCell>{row.invoice_number}</TableCell>
                    <TableCell>
                      {row.supplier?.name || '-'}
                      {unappliedCredit > 0 && (
                        <span className="ml-2 inline-block rounded bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                          Credit Rp {unappliedCredit.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{parseDate(row.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.receipt_total_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.paid_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(row.remaining_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadge[status] || 'secondary'}>{status}</Badge>
                    </TableCell>
                    <TableCell>
                      {!paidOut && <PayoutDialog payableId={row.id} remainingAmount={Number(row.remaining_amount)} />}
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
