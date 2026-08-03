export interface CreateSupplierDto {
  name: string
  is_pbf?: boolean
  pbf_license_number?: string
  phone?: string
  payment_terms_days?: number
}

export interface PoItemDto {
  product_id: string
  qty_ordered: number
  unit_price: number
}

export interface CreatePurchaseOrderDto {
  supplier_id: string
  po_number: string
  notes?: string
  items: PoItemDto[]
}

export interface ReceiptItemDto {
  purchase_order_item_id: string
  product_id: string
  batch_number: string
  // Expiry date as ISO string (YYYY-MM-DD)
  expiry_date: string
  qty_received: number
  unit_cost: number
}

export interface ReceiveGoodsDto {
  receipt_number: string
  invoice_number: string
  notes?: string
  items: ReceiptItemDto[]
}