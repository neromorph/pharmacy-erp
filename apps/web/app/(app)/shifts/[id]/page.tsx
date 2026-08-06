import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { closeShift, forceCloseShift } from '../actions'
import { getUserRole } from '../../../../utils/auth'
import { canForceCloseShift } from '../../../../lib/shifts'

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const statusColors: Record<string, string> = {
  OPEN: '#10b981',
  CLOSED: '#64748b',
  FORCE_CLOSED: '#ef4444',
}

function badgeStyle(color: string): React.CSSProperties {
  return { background: color, color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }
}

const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)', textAlign: 'left' }
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 14 }

async function handleClose(formData: FormData) {
  'use server'
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
  const { data: { user } } = await supabase.auth.getUser()

  const { data: shift } = await supabase.from('shifts').select('*').eq('id', id).single()
  if (!shift) return <p style={{ color: 'var(--danger)' }}>Shift not found</p>

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

  return (
    <section>
      <Link href="/shifts" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Shifts
      </Link>

      {sp.error && (
        <p style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {sp.error}
        </p>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Shift</h1>
        <span style={badgeStyle(statusColors[shift.status] || '#64748b')}>{shift.status}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px', fontSize: 13 }}>
        Opened: {parseDate(shift.opened_at)}
        {shift.closed_at && ` · Closed: ${parseDate(shift.closed_at)}`}
      </p>

      {/* Cash summary card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Opening Cash</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>{opening.toFixed(2)}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Sales Received</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>{totalPaid.toFixed(2)}</p>
        </div>
        {closing !== null ? (
          <>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Closing Cash</p>
              <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>{closing.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cash Variance</p>
              <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600, color: cashVariance !== null && cashVariance !== 0 ? 'var(--danger, #ef4444)' : 'inherit' }}>
                {cashVariance !== null ? (cashVariance >= 0 ? '+' : '') + cashVariance.toFixed(2) : '-'}
              </p>
            </div>
          </>
        ) : (
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Expected Closing</p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 600 }}>{expectedClosing.toFixed(2)}</p>
          </div>
        )}
      </div>

      {shift.notes && (
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
          Notes: {shift.notes}
        </p>
      )}

      {/* Sale list */}
      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>
        Sales ({sales?.length ?? 0})
        {draftCount != null && draftCount > 0 && (
          <span style={{ color: '#f59e0b', fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
            ({draftCount} draft — must be completed or cancelled before close)
          </span>
        )}
      </h2>
      {sales && sales.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)', marginBottom: 16 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Sale Number</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Grand Total</th>
              <th style={thStyle}>Paid</th>
              <th style={thStyle}>Time</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={tdStyle}>
                  <Link href={`/sales/${s.id}`} style={{ color: 'var(--primary)' }}>
                    {s.sale_number}
                  </Link>
                </td>
                <td style={tdStyle}>
                  <span style={badgeStyle({ DRAFT: '#64748b', PAID: '#10b981', VOID: '#ef4444' }[s.status as string] || '#64748b')}>
                    {s.status}
                  </span>
                </td>
                <td style={tdStyle}>{Number(s.grand_total).toFixed(2)}</td>
                <td style={tdStyle}>{Number(s.paid_amount || 0).toFixed(2)}</td>
                <td style={tdStyle}>{parseDate(s.sold_at || s.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>No sales in this shift</p>
      )}

      {/* Close / force-close form — only when shift is OPEN */}
      {shift.status === 'OPEN' && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h2 style={{ fontSize: 14, margin: '0 0 12px' }}>Close Shift</h2>

          {draftCount != null && draftCount > 0 && (
            <p style={{ color: '#f59e0b', fontSize: 13, marginBottom: 12 }}>
              Cannot close: {draftCount} draft sale(s) exist. Complete or cancel all draft sales first.
            </p>
          )}

          {canClose && (
            <form action={handleClose} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <input type="hidden" name="shift_id" value={shift.id} />
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Closing Cash</label>
                <input
                  name="closing_cash"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder={expectedClosing.toFixed(2)}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, width: 160 }}
                />
              </div>
              <button
                type="submit"
                disabled={!!(draftCount != null && draftCount > 0)}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  opacity: draftCount != null && draftCount > 0 ? 0.5 : 1,
                }}
              >
                Close Shift
              </button>
            </form>
          )}

          {canForce && !isOwnShift && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                This shift belongs to another user. Use force-close as owner.
              </p>
              <form action={handleForceClose} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <input type="hidden" name="shift_id" value={shift.id} />
                <div>
                  <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Closing Cash</label>
                  <input
                    name="closing_cash"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={expectedClosing.toFixed(2)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 14, width: 160 }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Force Close (Owner)
                </button>
              </form>
            </>
          )}

          {shift.status === 'OPEN' && !canClose && !canForce && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              You cannot close this shift.
            </p>
          )}
        </div>
      )}
    </section>
  )
}