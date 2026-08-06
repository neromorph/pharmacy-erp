import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { buildStatementLedger, computeSupplierBalance } from '../../../../lib/purchase-returns'
import { PrintButton } from './print-button'

// A4 print CSS scoped to .statement-print.
function printCss(): string {
  return `
  @media print {
    @page { size: A4; margin: 14mm; }
    body * { visibility: hidden; }
    .statement-print, .statement-print * { visibility: visible; }
    .statement-print { position: absolute; top: 0; left: 0; width: 100%; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 4px 8px; font-size: 12px; }
  }
`
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!role || role === 'CASHIER') {
    return <p style={{ color: 'var(--danger)' }}>Access denied. Owner, pharmacist, or inventory only.</p>
  }

  const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (!supplier) return <p>Supplier not found</p>

  const { data: payables } = await supabase
    .from('accounts_payables')
    .select('id, invoice_number, due_date, receipt_total_amount, paid_amount, remaining_amount, goods_receipts(received_at, purchase_order_id)')
    .eq('supplier_id', id)

  const payableIds = (payables || []).map((p: any) => p.id)
  const { data: payments } =
    payableIds.length > 0
      ? await supabase
          .from('accounts_payable_payments')
          .select('id, paid_at, amount, method, notes, credit_applied_amount, accounts_payable_id')
          .in('accounts_payable_id', payableIds)
          .order('paid_at', { ascending: true })
      : { data: [] }

  const { data: returns } = await supabase
    .from('purchase_returns')
    .select('id, return_number, returned_at, reason, total_amount')
    .eq('supplier_id', id)
    .order('returned_at', { ascending: true })

  // Map invoice number to its purchase order id for the drill-down links.
  // The typegen types the to-one embed as an array; cast to any.
  const poByInvoice = new Map<string, string>()
  for (const p of (payables || []) as any[]) {
    poByInvoice.set(p.invoice_number, p.goods_receipts?.purchase_order_id)
  }

  const ledger = buildStatementLedger({
    invoices: (payables || []).map((p: any) => ({
      date: p.goods_receipts?.received_at || p.due_date,
      ref: p.invoice_number,
      description: 'Invoice',
      amount: Number(p.receipt_total_amount),
    })),
    payments: (payments || []).map((pm: any) => ({
      date: pm.paid_at,
      ref: pm.method,
      description: pm.notes || 'Payment',
      amount: Number(pm.amount),
      creditApplied: Number(pm.credit_applied_amount || 0),
    })),
    returns: (returns || []).map((r: any) => ({
      date: r.returned_at,
      ref: r.return_number,
      description: r.reason,
      amount: Number(r.total_amount),
    })),
  })

  const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0
  const balance = computeSupplierBalance(
    (payables || []).map((p: any) => ({ remaining: Number(p.remaining_amount) })),
    (returns || []).map((r: any) => ({ total: Number(r.total_amount), applied: 0 }))
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCss() }} />
      <section style={{ maxWidth: 860 }}>
        <div
          className="no-print"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}
        >
          <Link href="/suppliers" style={{ color: 'var(--primary)' }}>
            Back to Suppliers
          </Link>
          <PrintButton />
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>{supplier.name}</h1>

        <div
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            fontSize: 14,
          }}
        >
          <div>
            PBF: <strong>{supplier.is_pbf ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            License: <strong>{supplier.pbf_license_number || '-'}</strong>
          </div>
          <div>
            Phone: <strong>{supplier.phone || '-'}</strong>
          </div>
          <div>
            Payment Terms: <strong>{supplier.payment_terms_days} days</strong>
          </div>
        </div>

        <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Statement (Kartu Hutang)</h2>
        <div className="statement-print">
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Supplier: {supplier.name} • Generated: {new Date().toLocaleDateString()}
          </div>
          {ledger.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No transactions yet</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card)' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Debit</th>
                  <th style={thStyle}>Credit</th>
                  <th style={thStyle}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => {
                  const poId = poByInvoice.get(row.ref)
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{parseDate(row.date)}</td>
                      <td style={tdStyle}>
                        {poId ? (
                          <Link href={`/procurement/${poId}`} style={{ color: 'var(--primary)' }}>
                            {row.ref}
                          </Link>
                        ) : (
                          row.ref
                        )}
                      </td>
                      <td style={tdStyle}>{row.description}</td>
                      <td style={tdStyle}>{row.debit > 0 ? row.debit.toFixed(2) : ''}</td>
                      <td style={tdStyle}>{row.credit > 0 ? row.credit.toFixed(2) : ''}</td>
                      <td style={tdStyle}>{row.balance.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                  <td style={tdStyle} colSpan={5}>
                    Closing Balance
                  </td>
                  <td style={tdStyle}>
                    {closingBalance.toFixed(2)}
                    {balance < 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}> (credit balance)</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </section>
    </>
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
