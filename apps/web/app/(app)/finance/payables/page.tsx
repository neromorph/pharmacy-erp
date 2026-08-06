import { createClient } from '../../../../utils/supabase/server'
import { getPayableStatus } from '../../../../lib/accounts-payable'
import { getAgingBucket, type AgingBucket } from '../../../../lib/purchase-returns'
import { postPayout } from './actions'
import { AgingCards, type BucketSummary } from './aging-cards'
import { AgingCsvButton } from './aging-csv-button'

const statusColors: Record<string, string> = {
  UNPAID: '#f59e0b',
  PARTIAL: '#3b82f6',
  PAID: '#0d9488',
  OVERDUE: '#ef4444',
}

const paymentMethods = ['CASH', 'TRANSFER', 'CARD', 'QRIS']

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

  if (payablesRes.error) return <p style={{ color: 'var(--danger)' }}>Payables unavailable</p>

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
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Accounts Payable</h1>
        {csvRows.length > 0 && <AgingCsvButton rows={csvRows} />}
      </div>
      <AgingCards summaries={summaries} />
      {rows.length === 0 ? (
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
              const unappliedCredit = unappliedBySupplier.get(row.supplier_id) || 0
              return (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={tdStyle}>{row.invoice_number}</td>
                  <td style={tdStyle}>
                    {row.supplier?.name || '-'}
                    {unappliedCredit > 0 && (
                      <span
                        style={{
                          display: 'inline-block',
                          marginLeft: 8,
                          background: '#0d9488',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        Credit Rp {unappliedCredit.toFixed(2)}
                      </span>
                    )}
                  </td>
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
