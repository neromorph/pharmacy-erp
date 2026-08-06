'use client'

import { useState } from 'react'
import { createPurchaseReturn } from './actions'

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
}

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
    <form
      action={createPurchaseReturn}
      style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Supplier</label>
          <select name="supplier_id" required style={inputStyle} defaultValue="">
            <option value="" disabled>
              Select supplier
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Return Number</label>
          <input name="return_number" required placeholder="RTR-2608-001" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Reason</label>
          <select name="reason" required style={inputStyle} defaultValue="">
            <option value="" disabled>
              Select reason
            </option>
            <option value="EXPIRED">Expired</option>
            <option value="DAMAGED">Damaged</option>
            <option value="RECALL">Recall</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PBF Credit Note Number</label>
          <input name="pbf_credit_note_number" placeholder="Optional" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Returned At</label>
          <input name="returned_at" type="date" required style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Notes</label>
          <input name="notes" placeholder="Optional" style={inputStyle} />
        </div>
      </div>

      <h2 style={{ fontSize: 14, margin: '0 0 8px' }}>Items</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {rows.map((row, index) => (
          <div
            key={index}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 12,
              display: 'grid',
              gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto',
              gap: 8,
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Product</label>
              <select
                value={row.productId}
                required
                style={inputStyle}
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
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Batch</label>
              <select
                name="batch_id"
                value={row.batchId}
                required
                style={inputStyle}
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
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Qty</label>
              <input
                name="qty_returned"
                type="number"
                step="0.001"
                min="0.001"
                required
                value={row.qty}
                style={inputStyle}
                onChange={(e) => updateRow(index, { qty: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Unit Cost</label>
              <input
                name="unit_cost"
                type="number"
                step="0.01"
                min="0"
                required
                value={row.unitCost}
                style={inputStyle}
                onChange={(e) => updateRow(index, { unitCost: e.target.value })}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={() => removeRow(index)}
                style={{
                  background: 'transparent',
                  color: 'var(--danger)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
            <input type="hidden" name="product_id" value={row.productId} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        style={{
          marginTop: 12,
          background: 'transparent',
          color: 'var(--primary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 16px',
          cursor: 'pointer',
        }}
      >
        Add Item
      </button>

      <button
        type="submit"
        style={{
          marginTop: 16,
          marginLeft: 12,
          background: 'var(--primary)',
          color: '#fff',
          padding: '8px 16px',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Create Return
      </button>
    </form>
  )
}
