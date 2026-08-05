import { createClient } from '../../../utils/supabase/server'
import { getPayableStatus } from '../../../lib/accounts-payable'
import { postPayout } from './actions'

const statusColors: Record<string, string> = {
  UNPAID: '#f59e0b',
  PARTIAL: '#3b82f6',
  PAID: '#0d9488',
  OVERDUE: '#ef4444',
}

const paymentMethods = ['CASH', 'TRANSFER', 'CARD', 'QRIS']

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function PayablesPage() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('accounts_payables')
    .select(
      'id, invoice_number, due_date, receipt_total_amount, paid_amount, remaining_amount, supplier:suppliers(name)'
    )
    .order('due_date', { ascending: true })

  if (error) return <p style={{ color: 'var(--danger)' }}>Payables unavailable</p>

  const now = new Date().toISOString()

  return (
    <section>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Accounts Payable</h1>
      {!rows || rows.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No payables yet</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={thStyle}>Invoice</th>
              <th style={thStyle}>Supplier</th>
              <th style={thStyle}>Due Date</th>
              <th style={thStyle}>Total</th>
              <th style={thStyle}>Paid</th>
              <th style={thStyle}>Remaining</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Payout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any) => {
              const status = getPayableStatus({
                paidAmount: Number(row.paid_amount),
                remainingAmount: Number(row.remaining_amount),
                dueDate: row.due_date,
                now,
              })
              const paidOut = status === 'PAID' || Number(row.remaining_amount) <= 0
              return (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{row.invoice_number}</td>
                  <td style={tdStyle}>{row.supplier?.name || '-'}</td>
                  <td style={tdStyle}>{parseDate(row.due_date)}</td>
                  <td style={tdStyle}>{Number(row.receipt_total_amount).toFixed(2)}</td>
                  <td style={tdStyle}>{Number(row.paid_amount).toFixed(2)}</td>
                  <td style={tdStyle}>{Number(row.remaining_amount).toFixed(2)}</td>
                  <td style={tdStyle}>
                    <span style={badgeStyle(statusColors[status] || '#64748b')}>{status}</span>
                  </td>
                  <td style={tdStyle}>
                    {!paidOut && (
                      <form action={postPayout} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="hidden" name="accounts_payable_id" value={row.id} />
                        <input
                          name="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={Number(row.remaining_amount)}
                          required
                          placeholder="Amount"
                          style={miniInputStyle}
                        />
                        <select name="method" style={miniInputStyle}>
                          {paymentMethods.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input name="notes" placeholder="Notes" style={miniInputStyle} />
                        <button type="submit" style={payoutButtonStyle}>
                          Pay
                        </button>
                      </form>
                    )}
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

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 600,
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
}

const miniInputStyle: React.CSSProperties = {
  width: 72,
  padding: '4px 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 13,
  background: '#fff',
}

const payoutButtonStyle: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  padding: '4px 10px',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    background: color,
    color: '#fff',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
  }
}
