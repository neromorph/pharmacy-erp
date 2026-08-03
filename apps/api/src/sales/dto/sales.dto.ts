// Sale line item as sent from the client.
export interface SaleItemDto {
  product_id: string
  qty_sold: number
  unit_price: number
}

// Create a DRAFT sale with its line items.
export interface CreateSaleDto {
  sale_number: string
  items: SaleItemDto[]
}

// Payment input for paying a DRAFT sale.
export interface PaySaleDto {
  payment_method: string
  paid_amount: number
  reference_number?: string
}
