import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'
import { listOpenShift } from './actions'

// ASD-STE100: shared utility for date display
function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium' })
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

export default async function ShiftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Shifts</h1>
        {!currentShift && (
          <Link
            href="/shifts/new"
            style={{
              background: 'var(--primary)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 6,
              textDecoration: 'none',
              fontSize: 14,
            }}
          >
            Open Shift
          </Link>
        )}
      </div>

      {/* Current open shift */}
      {currentShift && (
        <div
          style={{
            background: 'var(--card)',
            border: '1px solid #10b981',
            borderRadius: 8,
            padding: 16,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Open Shift</h2>
            <span style={badgeStyle(statusColors['OPEN'])}>OPEN</span>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Cashier: <strong>{currentShift.cashier_name || user?.email || '-'}</strong>
          </p>
          <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            Opened: {parseDate(currentShift.opened_at)}
          </p>
          <p style={{ margin: '4px 0', fontSize: 14 }}>
            Opening Cash: <strong>{Number(currentShift.opening_cash).toFixed(2)}</strong>
          </p>
          <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            {currentShift.notes || 'No notes'}
          </p>
          <Link
            href={`/shifts/${currentShift.id}`}
            style={{ color: 'var(--primary)', fontSize: 13, display: 'inline-block', marginTop: 8 }}
          >
            View &amp; Close Shift →
          </Link>
        </div>
      )}

      {/* Past shifts */}
      <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Shift History</h2>
      {pastShifts.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No past shifts</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Cashier</th>
              <th style={thStyle}>Opened</th>
              <th style={thStyle}>Closed</th>
              <th style={thStyle}>Opening Cash</th>
              <th style={thStyle}>Closing Cash</th>
              <th style={thStyle}>Variance</th>
              <th style={thStyle}>Notes</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {pastShifts.map((shift) => {
              const opening = Number(shift.opening_cash)
              const closing = shift.closing_cash != null ? Number(shift.closing_cash) : null
              const variance = closing !== null ? closing - opening : null
              return (
                <tr key={shift.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdStyle}>
                    <span style={badgeStyle(statusColors[shift.status] || '#64748b')}>{shift.status}</span>
                  </td>
                  <td style={tdStyle}>{shift.cashier_name || '—'}</td>
                  <td style={tdStyle}>{parseDate(shift.opened_at)}</td>
                  <td style={tdStyle}>{shift.closed_at ? parseDate(shift.closed_at) : '-'}</td>
                  <td style={tdStyle}>{opening.toFixed(2)}</td>
                  <td style={tdStyle}>{closing !== null ? closing.toFixed(2) : '-'}</td>
                  <td style={tdStyle}>
                    {variance !== null ? (
                      <span style={{ color: variance < 0 ? 'var(--danger, #ef4444)' : 'inherit' }}>
                        {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={tdStyle}>{shift.notes || '-'}</td>
                  <td style={tdStyle}>
                    <Link href={`/shifts/${shift.id}`} style={{ color: 'var(--primary)', fontSize: 13 }}>
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}