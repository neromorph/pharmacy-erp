import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { listOpenShift } from './actions'
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

// ASD-STE100: shared utility for date display
function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' })
}

const statusVariant = {
  OPEN: 'default',
  CLOSED: 'secondary',
  FORCE_CLOSED: 'destructive',
} satisfies Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>

export default async function ShiftsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentShift = await listOpenShift()

  // Past shifts for this user
  let pastShifts: any[] = []
  if (user) {
    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'OPEN')
      .order('closed_at', { ascending: false })
    pastShifts = data || []
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Shifts</h1>
        {!currentShift && <Button render={<Link href="/shifts/new" />}>Open Shift</Button>}
      </div>

      {/* Current open shift */}
      {currentShift && (
        <div className="rounded-xl bg-card py-4 ring-1 ring-emerald-500/50">
          <div className="flex items-center gap-2 px-4 pb-1">
            <h2 className="text-base font-medium text-slate-900">Open Shift</h2>
            <Badge variant="default">OPEN</Badge>
          </div>
          <div className="space-y-1 px-4 text-sm text-slate-500">
            <p>
              Cashier: <strong className="text-slate-900">{currentShift.cashier_name || user?.email || '-'}</strong>
            </p>
            <p>Opened: {parseDate(currentShift.opened_at)}</p>
            <p className="text-slate-900">
              Opening Cash: <strong>{Number(currentShift.opening_cash).toFixed(2)}</strong>
            </p>
            <p>{currentShift.notes || 'No notes'}</p>
          </div>
          <div className="px-4 pt-2">
            <Link
              href={`/shifts/${currentShift.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              View &amp; Close Shift →
            </Link>
          </div>
        </div>
      )}

      {/* Past shifts */}
      <div className="space-y-3">
        <h2 className="text-base font-medium text-slate-900">Shift History</h2>
        {pastShifts.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada shift sebelumnya</p>
        ) : (
          <Table>
            <TableHeader className="sticky top-14 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Kasir</TableHead>
                <TableHead>Dibuka</TableHead>
                <TableHead>Ditutup</TableHead>
                <TableHead className="text-right">Kas Pembukaan</TableHead>
                <TableHead className="text-right">Kas Penutupan</TableHead>
                <TableHead className="text-right">Selisih</TableHead>
                <TableHead>Catatan</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastShifts.map((shift) => {
                const opening = Number(shift.opening_cash)
                const closing = shift.closing_cash != null ? Number(shift.closing_cash) : null
                const variance = closing !== null ? closing - opening : null
                // SAFETY: shift.status is always one of the shift status values from the query.
                const badgeVariant = statusVariant[shift.status as keyof typeof statusVariant] || 'secondary'
                return (
                  <TableRow key={shift.id} className="h-10">
                    <TableCell>
                      <Badge variant={badgeVariant}>
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{shift.cashier_name || '—'}</TableCell>
                    <TableCell>{parseDate(shift.opened_at)}</TableCell>
                    <TableCell>{shift.closed_at ? parseDate(shift.closed_at) : '-'}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {opening.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {closing !== null ? closing.toFixed(2) : '-'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {variance !== null ? (
                        <span className={variance < 0 ? 'text-destructive' : ''}>
                          {variance >= 0 ? '+' : ''}
                          {variance.toFixed(2)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{shift.notes || '-'}</TableCell>
                    <TableCell>
                      <Link href={`/shifts/${shift.id}`} className="text-sm text-primary">
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}
