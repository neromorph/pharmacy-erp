export type PayableStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'

// Compare calendar dates only, in YYYY-MM-DD form
function dateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

// Return true if the payable is past its due date with a remaining balance
export function isPayableOverdue(input: { remainingAmount: number; dueDate: string; now: string }): boolean {
  return input.remainingAmount > 0 && dateKey(input.now) > dateKey(input.dueDate)
}

// Derive payable status from paid and remaining amounts and the due date
export function getPayableStatus(input: { paidAmount: number; remainingAmount: number; dueDate: string; now: string }): PayableStatus {
  if (input.remainingAmount <= 0) return 'PAID'
  if (isPayableOverdue(input)) return 'OVERDUE'
  if (input.paidAmount > 0) return 'PARTIAL'
  return 'UNPAID'
}
