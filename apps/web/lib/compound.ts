// Compound helpers — pure logic for parent/child racikan sales.

// Sum qty_sold per real product, skipping parent compound rows (product_id null).
// Children reference real products and are the only rows that consume stock.
export function perProductQuantities(
  items: { product_id: string | null; qty_sold: number }[]
): Map<string, number> {
  const perProduct = new Map<string, number>()
  for (const item of items) {
    if (!item.product_id) continue
    perProduct.set(item.product_id, (perProduct.get(item.product_id) || 0) + Number(item.qty_sold))
  }
  return perProduct
}

// Sum embalase from parent rows (parent_item_id null) into a sale total.
export function sumEmbalase(items: { parent_item_id: string | null; embalase_amount: number }[]): number {
  return items.reduce(
    (sum, it) => (it.parent_item_id === null ? sum + Number(it.embalase_amount || 0) : sum),
    0
  )
}