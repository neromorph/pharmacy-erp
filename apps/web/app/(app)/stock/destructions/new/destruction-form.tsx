'use client'

import { useState } from 'react'
import { createDestruction } from './actions'

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
}

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
      style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>BAP Number</label>
          <input name="bap_number" required placeholder="BAP-2608-001" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>BAP Date</label>
          <input name="bap_date" type="date" required style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Witness Names</label>
          <input
            name="witness_names"
            required
            placeholder="Names of BPOM/Dinkes witnesses"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Reason</label>
          <select name="reason" required style={inputStyle} defaultValue="">
            <option value="" disabled>
              Select reason
            </option>
            <option value="EXPIRED">Expired</option>
            <option value="DAMAGED">Damaged</option>
          </select>
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
              gridTemplateColumns: '2fr 1.5fr 1fr auto',
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
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Qty Destroyed</label>
              <input
                name="qty_destroyed"
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
        Create Destruction
      </button>
    </form>
  )
}
