import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole } from '@pharmacy/domain'

// Human-readable role names and one-line permission hints.
export const ROLE_LABELS = {
  OWNER: { name: 'Pemilik', hint: 'Semua akses: pengaturan, persetujuan, laporan.' },
  PHARMACIST: { name: 'Apoteker', hint: 'Persetujuan opname, pembatalan transaksi, pemusnahan.' },
  INVENTORY: { name: 'Inventori', hint: 'Pengadaan, stok, dan penerimaan barang.' },
  CASHIER: { name: 'Kasir', hint: 'POS dan shift kasir.' },
} satisfies Record<UserRole, { name: string; hint: string }>

// Return the current user's role, or null when not signed in.
export async function getUserRole(supabase: SupabaseClient): Promise<UserRole | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // SAFETY: asserted value is validated before use or known from the source.
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
