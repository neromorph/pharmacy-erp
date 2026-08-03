// One tenant = one pharmacy branch; one user belongs to one tenant.
export const TENANT_SCOPE = 'branch' as const
export type TenantScope = typeof TENANT_SCOPE