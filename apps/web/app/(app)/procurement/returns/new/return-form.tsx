'use client'

import { useState } from 'react'
import { createPurchaseReturn } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ReturnBatch {
  id: string
  product_id: string
  batch_number: string
  expiry_date: string | null
  current_qty: number
}

export interface ReturnProduct {
  id: string
  name: string
  sku: string
}

interface ItemRow {
  productId: string
  batchId: string
  qty: string
  unitCost: string
}

const selectClass =
  'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function ReturnForm({
  suppliers,
  products,
  batches,
}: {
  suppliers: { id: string; name: string }[]
  products: ReturnProduct[]
  batches: ReturnBatch[]
}) {
  const [rows, setRows] = useState<ItemRow[]>([{ productId: '', batchId: '', qty: '', unitCost: '' }])

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
      return next
    })
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: '', batchId: '', qty: '', unitCost: '' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function batchesFor(productId: string): ReturnBatch[] {
    return batches.filter((b) => b.product_id === productId)
  }

  return (
    <form action={createPurchaseReturn} className="max-w-4xl space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="supplier_id">Pemasok</Label>
          <select id="supplier_id" name="supplier_id" required className={selectClass} defaultValue="">
            <option value="" disabled>
              Pilih pemasok
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="return_number">Nomor Retur</Label>
          <Input id="return_number" name="return_number" required placeholder="RTR-2608-001" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reason">Alasan</Label>
          <select id="reason" name="reason" required className={selectClass} defaultValue="">
            <option value="" disabled>
              Pilih alasan
            </option>
            <option value="EXPIRED">Kedaluwarsa</option>
            <option value="DAMAGED">Rusak</option>
            <option value="RECALL">Penarikan (Recall)</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pbf_credit_note_number">Nomor Nota Kredit PBF</Label>
          <Input id="pbf_credit_note_number" name="pbf_credit_note_number" placeholder="Opsional" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="returned_at">Tanggal Retur</Label>
          <Input id="returned_at" name="returned_at" type="date" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Catatan</Label>
          <Input id="notes" name="notes" placeholder="Opsional" />
        </div>
      </div>

      <h2 className="text-sm font-medium text-slate-900">Item Barang</h2>
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-border/60 p-3"
          >
            <div className="grid gap-1.5">
              <Label className="text-xs">Produk</Label>
              <select
                value={row.productId}
                required
                className={selectClass}
                onChange={(e) => updateRow(index, { productId: e.target.value, batchId: '' })}
              >
                <option value="" disabled>
                  Pilih produk
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Batch</Label>
              <select
                name="batch_id"
                value={row.batchId}
                required
                className={selectClass}
                disabled={!row.productId}
                onChange={(e) => updateRow(index, { batchId: e.target.value })}
              >
                <option value="" disabled>
                  Pilih batch
                </option>
                {batchesFor(row.productId).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} (ED {b.expiry_date ? String(b.expiry_date).slice(0, 10) : '-'}, qty {Number(b.current_qty)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Jumlah</Label>
              <Input
                name="qty_returned"
                type="number"
                step="0.001"
                min="0.001"
                required
                value={row.qty}
                className="w-24"
                onChange={(e) => updateRow(index, { qty: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Harga Satuan</Label>
              <Input
                name="unit_cost"
                type="number"
                step="0.01"
                min="0"
                required
                value={row.unitCost}
                className="w-24"
                onChange={(e) => updateRow(index, { unitCost: e.target.value })}
              />
            </div>
            <div>
              <Button type="button" variant="outline" onClick={() => removeRow(index)}>
                Hapus
              </Button>
            </div>
            <input type="hidden" name="product_id" value={row.productId} />
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          Tambah Item
        </Button>
        <Button type="submit">Buat Retur</Button>
      </div>
    </form>
  )
}
