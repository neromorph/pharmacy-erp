// Role is stored in app_metadata and set only by the admin API.
// It gates approvals (opname, void) and stock changes.
export const userRoleValues = ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'] as const

export type UserRole = (typeof userRoleValues)[number]

export interface JWTAppMetadata {
  tenant_id: string
  role: UserRole
}