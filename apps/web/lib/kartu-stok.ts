// Kartu Stok — pure helpers for derived stock ledger rows.

export type KartuStokMovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'VOID'

export interface KartuStokRow {
  type: KartuStokMovementType
  product_id: string
  batch_number: string
  expiry_date: string | null
  qty: number
  occurred_at: string
  source_id: string
  balance: number
}

export interface KartuStokRaw {
  type: KartuStokMovementType
  product_id: string
  batch_number: string
  expiry_date: string | null
  qty: number
  occurred_at: string
  source_id: string
}

/**
 * Accumulate running balance over time-ordered raw rows.
 * Must be called on rows already sorted by occurred_at.
 */
export function buildKartuStokRows(items: KartuStokRaw[]): KartuStokRow[] {
  let balance = 0
  return items.map((item) => {
    balance += item.qty
    return { ...item, balance }
  })
}

export function movementSign(type: KartuStokMovementType): number {
  if (type === 'IN' || type === 'ADJUSTMENT') return 1
  return -1 // OUT and VOID both subtract from balance
}

export function formatKartuStokMovement(type: KartuStokMovementType): string {
  switch (type) {
    case 'IN':
      return 'Masuk'
    case 'OUT':
      return 'Keluar'
    case 'ADJUSTMENT':
      return 'Penyesuaian'
    case 'VOID':
      return 'Void'
  }
}