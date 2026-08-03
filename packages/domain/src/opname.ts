// Stock opname status machine: DRAFT -> PENDING_APPROVAL -> APPROVED | CANCELLED.
// Batch quantity changes only when the session is APPROVED.
export const opnameStatusValues = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'CANCELLED',
] as const

export type OpnameStatus = (typeof opnameStatusValues)[number]

// The scope of one physical count session.
export const opnameTypeValues = ['FULL_STORE', 'RACK_BASED', 'AD_HOC_SINGLE'] as const

export type OpnameType = (typeof opnameTypeValues)[number]

// Why a batch count differs from the system count.
export const opnameReasonValues = ['DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC'] as const

export type OpnameReason = (typeof opnameReasonValues)[number]
