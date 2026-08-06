export const STAFF_ROLES = ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export function isOwnerRole(role: string | null): boolean {
  return role === 'OWNER'
}

export interface ManageStaffContext {
  callerRole: string | null
  callerId: string
  targetId: string
}

// Throws when the caller tries to modify their own role/active status
// or when the caller is not the Owner.
export function assertCanManageStaff(ctx: ManageStaffContext): void {
  if (ctx.callerRole !== 'OWNER') {
    throw new Error('Only the Owner may manage staff.')
  }
  if (ctx.callerId === ctx.targetId) {
    throw new Error('You cannot change your own role or active status.')
  }
}
