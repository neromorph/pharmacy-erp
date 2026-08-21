import { UserRole } from '@pharmacy/domain'
import { ShiftStatus } from '@pharmacy/domain'

// Return true if there is no open shift (cashier can open)
export function canOpenShift(currentOpenShiftId: string | null): boolean {
  return currentOpenShiftId === null
}

// Return true if there is an open shift to close
export function canCloseShift(currentOpenShiftId: string | null): boolean {
  return currentOpenShiftId !== null
}

// Return true if role can force-close any shift
export function canForceCloseShift(role: UserRole | null): boolean {
  return role === 'OWNER'
}

// Validate opening cash is a positive number
export function parseOpeningCash(formData: FormData) {
  // SAFETY: asserted value is validated before use or known from the source.
  const raw = formData.get('opening_cash') as string
  if (!raw) return { value: 0, error: 'Opening cash is required' }
  const num = parseFloat(raw)
  if (Number.isNaN(num) || num < 0) return { value: 0, error: 'Opening cash must be a non-negative number' }
  return { value: num, error: null }
}

// Format shift status for display
export function formatShiftStatus(status: ShiftStatus): string {
  switch (status) {
    case 'OPEN': return 'Open'
    case 'CLOSED': return 'Closed'
    case 'FORCE_CLOSED': return 'Force Closed'
  }
}