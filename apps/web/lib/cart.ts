// POS cart logic — pure helpers for the racikan builder and two-tiered gate.

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

// A plain item line or a racikan parent line.
export interface CartLine {
  kind: 'item' | 'racikan'
  // item:
  product_id?: string
  qty?: number
  unit_price?: number
  // racikan parent:
  name?: string
  dosage_count?: number
  price?: number // total compound price
  embalase?: number
  ingredients?: { product_id: string; per_dose: number }[]
}

export interface SaleDraftPayload {
  sale_type: 'OTC' | 'RESEP'
  lines: CartLine[]
  doctor_id?: string | null
  patient_id?: string | null
  new_doctor?: { name: string; sip_number?: string } | null
  new_patient?: { name: string; address?: string; phone?: string } | null
  tuslah: number
}

// Does a set of product categories force a RESEP sale?
export function requiresResep(categories: RegulatoryCategory[]): boolean {
  return categories.some((c) => REGULATORY_CATEGORY_ORDER[c] >= 1)
}

// Does a set of categories require the patient address (hard gate)?
export function requiresAddress(categories: RegulatoryCategory[]): boolean {
  return categories.some((c) => REGULATORY_CATEGORY_ORDER[c] >= 2)
}

export interface SaleTotals {
  subtotal: number
  embalaseTotal: number
  grandTotal: number
}

// Compute totals from cart lines. Item lines: qty x unit_price. Racikan parent
// lines: price (total compound charge) + embalase. Children never add to totals.
export function computeSaleTotals(lines: CartLine[], tuslah = 0): SaleTotals {
  let subtotal = 0
  let embalaseTotal = 0
  for (const line of lines) {
    if (line.kind === 'item') {
      subtotal += Number(line.qty || 0) * Number(line.unit_price || 0)
    } else {
      subtotal += Number(line.price || 0)
      embalaseTotal += Number(line.embalase || 0)
    }
  }
  return {
    subtotal,
    embalaseTotal,
    grandTotal: subtotal + embalaseTotal + tuslah,
  }
}

// Total raw ingredient consumed for a racikan line: per-dose fraction x
// dispensed dosage count (Q2 locked quantity model).
export function ingredientTotalQty(perDose: number, dosageCount: number): number {
  return Number(perDose) * Number(dosageCount)
}