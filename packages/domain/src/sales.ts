// Sale status machine: DRAFT -> PAID | VOID.
// Payment methods cover common pharmacy checkout paths.
export const saleStatusValues = ['DRAFT', 'PAID', 'VOID'] as const

export type SaleStatus = (typeof saleStatusValues)[number]

export const paymentMethodValues = ['CASH', 'CARD', 'TRANSFER', 'QRIS'] as const

export type PaymentMethod = (typeof paymentMethodValues)[number]

// A final status means the sale no longer changes.
export function isFinalSaleStatus(status: SaleStatus): boolean {
  return status === 'PAID' || status === 'VOID'
}
