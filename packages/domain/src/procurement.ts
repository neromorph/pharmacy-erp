// PO status machine: DRAFT -> PENDING_APPROVAL -> APPROVED -> RECEIVED | CANCELLED.
// Owner/Pharmacist can approve directly; Inventory/Purchasing needs approval.
export const procurementStatusValues = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'RECEIVED',
  'CANCELLED',
] as const

export type ProcurementStatus = (typeof procurementStatusValues)[number]

// A final status means the PO no longer changes.
export function isFinalPoStatus(status: ProcurementStatus): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED'
}
