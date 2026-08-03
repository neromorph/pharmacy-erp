import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole } from '@pharmacy/domain'

// Return the current user's role, or null when not signed in.
export async function getUserRole(supabase: SupabaseClient): Promise<UserRole | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user.app_metadata?.role as UserRole | null
}

// Only OWNER and PHARMACIST may approve a stock opname.
export function canApproveOpname(role: UserRole | null): boolean {
  return role === 'OWNER' || role === 'PHARMACIST'
}

// Only OWNER and PHARMACIST may void a sale.
export function canVoidSale(role: UserRole | null): boolean {
  return role === 'OWNER' || role === 'PHARMACIST'
}
