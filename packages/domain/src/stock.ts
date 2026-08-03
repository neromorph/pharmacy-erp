// FEFO is the primary stock rule: earliest expiry first.
export const STOCK_RULE = 'fefo' as const
export type StockRule = typeof STOCK_RULE