import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { closeShift, forceCloseShift } from '../actions'
import { getUserRole } from '../../../../utils/auth'
import { canForceCloseShift } from '../../../../lib/shifts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

interface StatusVariantMap {
  OPEN: 'default'
  CLOSED: 'secondary'
  FORCE_CLOSED: 'destructive'
}
const statusVariant: StatusVariantMap = {
  OPEN: 'default',
  CLOSED: 'secondary',
  FORCE_CLOSED: 'destructive',
}

interface SaleStatusVariantMap {
  DRAFT: 'outline'
  PAID: 'default'
  VOID: 'destructive'
}
const saleStatusVariant: SaleStatusVariantMap = {
  DRAFT: 'outline',
  PAID: 'default',
  VOID: 'destructive',
}

async function handleClose(formData: FormData) {
  'use server'
  // SAFETY: asserted value is validated before use or known from the source.
  const shiftId = formData.get('shift_id') as string
  const closingCash = Number(formData.get('closing_cash') || 0)
  try {
    await closeShift(shiftId, closingCash)
  } catch (e: any) {
    redirect(`/shifts/${shiftId}?error=${encodeURIComponent(e.message)}`)
    return
  }
  redirect(`/shifts/${shiftId}`)
}

async function handleForceClose(formData: FormData) {
  'use server'
  // SAFETY: asserted value is validated before use or known from the source.
  const shiftId = formData.get('shift_id') as string
  const closingCash = Number(formData.get('closing_cash') || 0)
  try {
    await forceCloseShift(shiftId, closingCash)
  } catch (e: any) {
    redirect(`/shifts/${shiftId}?error=${encodeURIComponent(e.message)}`)
    return
  }
  redirect(`/shifts/${shiftId}`)
}

export default async function ShiftDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: shift } = await supabase.from('shifts').select('*').eq('id', id).single()
  if (!shift) return <p className="text-sm text-destructive">Shift not found</p>

  const { data: sales } = await supabase
    .from('sales')
    .select('id, sale_number, status, grand_total, paid_amount, sold_at, created_at')
    .eq('shift_id', id)
    .order('created_at', { ascending: true })

  const { count: draftCount } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', id)
    .eq('status', 'DRAFT')

  const opening = Number(shift.opening_cash)
  const closing = shift.closing_cash != null ? Number(shift.closing_cash) : null
  const variance = closing !== null ? closing - opening : null

  // Total sales received in this shift (any payment method).
  const totalPaid = (sales || [])
    .filter((s) => s.status === 'PAID')
    .reduce((sum, s) => sum + Number(s.paid_amount || 0), 0)

  // Cash summary: expected closing = opening + cash sales only (map Q3).
  const { data: cashPayments } = await supabase
    .from('sale_payments')
    .select('amount, sales!inner(shift_id)')
    .eq('payment_method', 'CASH')
    .eq('sales.shift_id', id)
  const cashTotal = (cashPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const expectedClosing = opening + cashTotal
  const cashVariance = closing !== null ? closing - expectedClosing : null

  const isOwner = canForceCloseShift(role)
  const isOwnShift = shift.user_id === user?.id
  const canClose = shift.status === 'OPEN' && isOwnShift
  const canForce = shift.status === 'OPEN' && isOwner

  const stats = [
    { label: 'Opening Cash', value: opening.toFixed(2) },
    { label: 'Total Sales Received', value: totalPaid.toFixed(2) },
    closing !== null
      ? { label: 'Kas Penutupan', value: closing.toFixed(2) }
      : { label: 'Expected Closing', value: expectedClosing.toFixed(2) },
  ]

  // SAFETY: shift.status is always one of the shift status values from the query.
  const badgeVariant = statusVariant[shift.status as keyof typeof statusVariant] || 'secondary'
  return (
    <section className="space-y-6">
      <div>
        <Link href="/shifts" className="mb-4 inline-block text-sm text-primary hover:underline">
          Back to Shifts
        </Link>
        {sp.error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{sp.error}</p>
        )}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Shift</h1>
        <Badge variant={badgeVariant}>{shift.status}</Badge>
      </div>
      <p className="text-sm text-slate-500">
        Opened: {parseDate(shift.opened_at)}
        {shift.closed_at && ` · Closed: ${parseDate(shift.closed_at)}`}
      </p>

      {/* Cash summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader>
              <CardTitle className="text-xs uppercase tracking-wide text-slate-500">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {closing !== null && (
        <p
          className={`text-sm tabular-nums ${
            cashVariance !== null && cashVariance !== 0 ? 'text-destructive' : 'text-slate-500'
          }`}
        >
          Cash Variance: {cashVariance !== null ? (cashVariance >= 0 ? '+' : '') + cashVariance.toFixed(2) : '-'}
        </p>
      )}

      {shift.notes && <p className="text-sm text-slate-500">Notes: {shift.notes}</p>}

      {/* Sale list */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-slate-900">
          Sales ({sales?.length ?? 0})
          {draftCount != null && draftCount > 0 && (
            <span className="ml-2 text-sm font-normal text-amber-600">
              ({draftCount} draft — harus diselesaikan atau dibatalkan sebelum tutup)
            </span>
          )}
        </h2>
        {sales && sales.length > 0 ? (
          <Table>
            <TableHeader className="sticky top-14 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Nomor Transaksi</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Grand Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s) => {
                // SAFETY: s.status is always one of the sale status values from the query.
                const saleVariant = saleStatusVariant[s.status as keyof SaleStatusVariantMap] || 'secondary'
                return (
                <TableRow key={s.id} className="h-10">
                  <TableCell>
                    <Link href={`/sales/${s.id}`} className="text-primary">
                      {s.sale_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={saleVariant}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(s.grand_total).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(s.paid_amount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell>{parseDate(s.sold_at || s.created_at)}</TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-slate-500">No sales in this shift</p>
        )}
      </div>

      {/* Close / force-close form — only when shift is OPEN */}
      {shift.status === 'OPEN' && (
        <Card>
          <CardHeader>
            <CardTitle>Tutup Shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftCount != null && draftCount > 0 && (
              <p className="text-sm text-amber-600">
                Tidak dapat menutup: {draftCount} transaksi draft masih ada. Selesaikan atau batalkan semua transaksi draft
                first.
              </p>
            )}

            {canClose && (
              <form action={handleClose} className="flex items-end gap-3">
                <input type="hidden" name="shift_id" value={shift.id} />
                <div className="grid gap-1.5">
                  <Label htmlFor="closing_cash">Kas Penutupan</Label>
                  <Input
                    id="closing_cash"
                    name="closing_cash"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={expectedClosing.toFixed(2)}
                    className="w-40"
                  />
                </div>
                <Button type="submit" disabled={!!(draftCount != null && draftCount > 0)}>
                  Tutup Shift
                </Button>
              </form>
            )}

            {canForce && !isOwnShift && (
              <>
                <p className="text-sm text-slate-500">
                  Shift ini milik pengguna lain. Gunakan tutup paksa sebagai pemilik.
                </p>
                <form action={handleForceClose} className="flex items-end gap-3">
                  <input type="hidden" name="shift_id" value={shift.id} />
                  <div className="grid gap-1.5">
                    <Label htmlFor="force_closing_cash">Kas Penutupan</Label>
                    <Input
                      id="force_closing_cash"
                      name="closing_cash"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder={expectedClosing.toFixed(2)}
                      className="w-40"
                    />
                  </div>
                  <Button type="submit" variant="destructive">
                    Tutup Paksa (Pemilik)
                  </Button>
                </form>
              </>
            )}

            {shift.status === 'OPEN' && !canClose && !canForce && (
              <p className="text-sm text-slate-500">You cannot close this shift.</p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
