'use client'

import { useState } from 'react'
import { createDestruction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface DestructionBatch {
  id: string
  product_id: string
  batch_number: string
  expiry_date: string | null
  current_qty: number
}

export interface DestructionProduct {
  id: string
  name: string
  sku: string
}

interface ItemRow {
  productId: string
  batchId: string
  qty: string
}

const selectClass =
  'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function DestructionForm({
  products,
  batches,
}: {
  products: DestructionProduct[]
  batches: DestructionBatch[]
}) {
  const [rows, setRows] = useState<ItemRow[]>([{ productId: '', batchId: '', qty: '' }])

  function updateRow(index: number, patch: Partial<ItemRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: '', batchId: '', qty: '' }])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  function batchesFor(productId: string): DestructionBatch[] {
    return batches.filter((b) => b.product_id === productId)
  }

  return (
    <form
      action={createDestruction}
      className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
    >
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="bap_number">BAP Number</Label>
          <Input id="bap_number" name="bap_number" required placeholder="BAP-2608-001" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bap_date">BAP Date</Label>
          <Input id="bap_date" name="bap_date" type="date" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="witness_names">Witness Names</Label>
          <Input
            id="witness_names"
            name="witness_names"
            required
            placeholder="Names of BPOM/Dinkes witnesses"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reason">Reason</Label>
          <select name="reason" required className={selectClass} defaultValue="">
            <option value="" disabled>
              Select reason
            </option>
            <option value="EXPIRED">Expired</option>
            <option value="DAMAGED">Damaged</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Optional" />
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-base font-medium text-slate-900">Items</h2>
      <div className="grid gap-3">
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid items-end gap-x-3 gap-y-2 rounded-lg border border-border/60 p-3 sm:grid-cols-[2fr_1.5fr_1fr_auto]"
          >
            <div className="grid gap-1.5">
              <Label htmlFor={`product-${index}`}>Product</Label>
              <select
                id={`product-${index}`}
                value={row.productId}
                required
                className={selectClass}
                onChange={(e) => updateRow(index, { productId: e.target.value, batchId: '' })}
              >
                <option value="" disabled>
                  Select product
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`batch-${index}`}>Batch</Label>
              <select
                id={`batch-${index}`}
                name="batch_id"
                value={row.batchId}
                required
                className={selectClass}
                disabled={!row.productId}
                onChange={(e) => updateRow(index, { batchId: e.target.value })}
              >
                <option value="" disabled>
                  Select batch
                </option>
                {batchesFor(row.productId).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batch_number} (ED {b.expiry_date ? String(b.expiry_date).slice(0, 10) : '-'}, qty {Number(b.current_qty)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`qty-${index}`}>Qty Destroyed</Label>
              <Input
                id={`qty-${index}`}
                name="qty_destroyed"
                type="number"
                step="0.001"
                min="0.001"
                required
                value={row.qty}
                onChange={(e) => updateRow(index, { qty: e.target.value })}
              />
            </div>
            <div>
              <Button type="button" variant="outline" onClick={() => removeRow(index)}>
                Remove
              </Button>
            </div>
            <input type="hidden" name="product_id" value={row.productId} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          Add Item
        </Button>
        <Button type="submit">
          Create Destruction
        </Button>
      </div>
    </form>
  )
}