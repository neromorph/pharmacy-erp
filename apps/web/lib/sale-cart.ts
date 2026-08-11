// Sales cart logic — pure helpers for sale rules and totals.

export type RegulatoryCategory =
  | 'BEBAS'
  | 'BEBAS_TERBATAS'
  | 'KERAS'
  | 'PSIKOTROPIKA'
  | 'NARKOTIKA'

export const REGULATORY_CATEGORY_ORDER: Record<RegulatoryCategory, number> = {
  BEBAS: 0,
  BEBAS_TERBATAS: 0,
  KERAS: 1,
  PSIKOTROPIKA: 2,
  NARKOTIKA: 2,
}

export interface CartLine {
  kind: 'item' | 'racikan'
  product_id?: string
  qty?: number
  unit_price?: number
  name?: string
  dosage_count?: number
  price?: number
  embalase?: number
  ingredients?: { product_id: string; per_dose: number }[]
}

export interface SaleDraftPayload {
  sale_type: 'OTC' | 'RESEP' | 'BPJS' | 'SARANA'
  lines: CartLine[]
  doctor_id?: string | null
  patient_id?: string | null
  new_doctor?: { name: string; sip_number?: string } | null
  new_patient?: { name: string; address?: string; phone?: string } | null
  tuslah: number
}

export function requiresResep(categories: RegulatoryCategory[]): boolean {
  return categories.some((c) => REGULATORY_CATEGORY_ORDER[c] >= 1)
}

export function requiresAddress(categories: RegulatoryCategory[]): boolean {
  return categories.some((c) => REGULATORY_CATEGORY_ORDER[c] >= 2)
}

export interface SaleTotals {
  subtotal: number
  embalaseTotal: number
  grandTotal: number
}

export function computeSaleTotals(lines: CartLine[], tuslah = 0): SaleTotals {
  let subtotal = 0
  let embalaseTotal = 0
  for (const line of lines) {
    if (line.kind === 'item') subtotal += Number(line.qty || 0) * Number(line.unit_price || 0)
    else {
      subtotal += Number(line.price || 0)
      embalaseTotal += Number(line.embalase || 0)
    }
  }
  return { subtotal, embalaseTotal, grandTotal: subtotal + embalaseTotal + tuslah }
}

export function ingredientTotalQty(perDose: number, dosageCount: number): number {
  return Number(perDose) * Number(dosageCount)
}

export function isBpjsCheckoutBlocked(
  saleType: string,
  patient: { bpjs_number?: string | null } | null
): boolean {
  if (saleType !== 'BPJS') return false
  return !patient?.bpjs_number
}
