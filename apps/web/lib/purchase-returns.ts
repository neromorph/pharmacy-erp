// Purchase return and aging helpers for AP v2.

export type AgingBucket = 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+'

// Label a payable by days past its due date.
// Due today or later = CURRENT. Positive days = overdue bucket.
export function getAgingBucket(dueDate: string, today: string): AgingBucket {
  const due = new Date(dueDate)
  const now = new Date(today)
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((startOfToday.getTime() - startOfDue.getTime()) / 86400000)
  if (days <= 0) return 'CURRENT'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export interface CreditSplit {
  creditApplied: number
  cash: number
}

// Split a payout total into credit-applied and cash portions.
// Credit is applied first, capped at the payout amount.
export function splitPayout(total: number, unappliedCredit: number): CreditSplit {
  const creditApplied = Math.max(0, Math.min(unappliedCredit, total))
  return { creditApplied, cash: total - creditApplied }
}

export interface CreditNote {
  id: string
  total: number
  applied: number
}

// Consume credit notes oldest-first and return updated applied amounts.
export function applyCreditFifo(notes: CreditNote[], amount: number): CreditNote[] {
  let remaining = amount
  return notes.map((n) => {
    const available = n.total - n.applied
    const use = Math.max(0, Math.min(remaining, available))
    remaining -= use
    return { ...n, applied: n.applied + use }
  })
}

// Supplier balance = remaining payables minus unapplied credit.
// Negative result = the supplier owes the pharmacy.
export function computeSupplierBalance(
  payables: { remaining: number }[],
  returns: { total: number; applied: number }[]
): number {
  const owed = payables.reduce((s, p) => s + Number(p.remaining || 0), 0)
  const unapplied = returns.reduce((s, r) => s + (Number(r.total || 0) - Number(r.applied || 0)), 0)
  return owed - unapplied
}

export interface PayableCsvRow {
  supplier: string
  invoice: string
  dueDate: string
  total: number
  paid: number
  remaining: number
  status: string
  bucket: AgingBucket
}

function escapeCsv(value: string | number): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

// Build a CSV of open payables with an aging bucket column.
export function buildAgingCsv(rows: PayableCsvRow[]): string {
  const header = 'Supplier,Invoice,Due Date,Total,Paid,Remaining,Status,Bucket'
  const body = rows.map((r) =>
    [r.supplier, r.invoice, r.dueDate, r.total, r.paid, r.remaining, r.status, r.bucket]
      .map(escapeCsv)
      .join(',')
  )
  return [header, ...body].join('\n')
}

export interface LedgerRow {
  date: string
  ref: string
  description: string
  debit: number
  credit: number
  balance: number
}

// Build a running-balance ledger from invoices, payments, and returns.
// Payment credit = amount minus credit applied. Return credit = full total.
export function buildStatementLedger(input: {
  invoices: { date: string; ref: string; description?: string; amount: number }[]
  payments: { date: string; ref: string; description?: string; amount: number; creditApplied: number }[]
  returns: { date: string; ref: string; description?: string; amount: number }[]
}): LedgerRow[] {
  const rows: Omit<LedgerRow, 'balance'>[] = [
    ...input.invoices.map((r) => ({
      date: r.date,
      ref: r.ref,
      description: r.description || 'Invoice',
      debit: Number(r.amount),
      credit: 0,
    })),
    ...input.payments.map((r) => ({
      date: r.date,
      ref: r.ref,
      description: r.description || 'Payment',
      debit: 0,
      credit: Number(r.amount) - Number(r.creditApplied || 0),
    })),
    ...input.returns.map((r) => ({
      date: r.date,
      ref: r.ref,
      description: r.description || 'Return',
      debit: 0,
      credit: Number(r.amount),
    })),
  ]
  rows.sort((a, b) => a.date.localeCompare(b.date))
  let balance = 0
  return rows.map((r) => {
    balance += r.debit - r.credit
    return { ...r, balance }
  })
}
