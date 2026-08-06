/**
 * Pure receipt formatting helpers.
 * No Supabase client, no side effects.
 */

// ponytail: change when tenant adds address/logo/sia/sipa/receipt_footer columns
export interface TenantProfile {
  id: string
  name: string
  // TODO: add address, phone, sia_number, sipa_number, logo_url, receipt_footer
  // when tenant schema expands
}

export interface SaleItem {
  products?: { name: string; sku: string }
  product_id: string
  qty_sold: number
  unit_price: number
  line_total: number
  batch_number?: string | null
  expiry_date?: string | null
}

export interface SalePayment {
  payment_method: string
  // NUMERIC may reach the client as a string; coerced with Number() at use.
  amount: number | string
}

export interface SaleRow {
  id: string
  sale_number: string
  status: string
  grand_total: number
  paid_amount: number
  change_amount: number
  sold_at?: string | null
  created_at: string
  sale_items?: SaleItem[]
  sale_payments?: SalePayment[]
}

export interface TenderResult {
  label: string
  amount: number
  change: number
}

/**
 * Format payment tender label and amount for receipt.
 * - 0 payments: fallback to "CASH"
 * - 1 payment: use that method
 * - 2+ payments: label = "SPLIT", amount = total paid
 */
export function formatReceiptTender(
  payments: SalePayment[],
  grandTotal: number
): TenderResult {
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const change = totalPaid - grandTotal

  if (payments.length === 0) {
    return { label: 'CASH', amount: grandTotal, change: 0 }
  }
  if (payments.length === 1) {
    return {
      label: payments[0].payment_method,
      amount: Number(payments[0].amount || 0),
      change: Math.max(0, change),
    }
  }
  // 2+ payments
  return {
    label: payments.length === 2 ? 'SPLIT' : 'MULTI',
    amount: totalPaid,
    change: Math.max(0, change),
  }
}

/** Format a number as Indonesian Rupiah string. */
export function formatRupiah(n: number): string {
  return `Rp ${Number(n).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ponytail: no buildReceiptLines helper needed — page renders directly from data