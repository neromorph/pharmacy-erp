// Shift management types

export const shiftStatusValues = ['OPEN', 'CLOSED', 'FORCE_CLOSED'] as const

export type ShiftStatus = (typeof shiftStatusValues)[number]

export interface ShiftRow {
  id: string
  tenant_id: string
  user_id: string
  status: ShiftStatus
  opening_cash: string
  closing_cash: string | null
  opened_at: string
  closed_at: string | null
  notes: string | null
}