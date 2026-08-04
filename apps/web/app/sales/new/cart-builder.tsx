'use client'

import { useMemo, useState } from 'react'
import { createDraftSale } from './actions'
import {
  requiresAddress,
  requiresResep,
  computeSaleTotals,
  ingredientTotalQty,
  RegulatoryCategory,
} from '../../../lib/cart'

interface ProductLite {
  id: string
  name: string
  sku: string
  base_unit: string
  allow_fractional: boolean
  regulatory_category: RegulatoryCategory
}

interface DoctorLite { id: string; name: string; sip_number: string | null }
interface PatientLite { id: string; name: string; address: string | null }

interface IngredientRow {
  product_id: string
  per_dose: string
}
interface Line {
  kind: 'item' | 'racikan'
  product_id?: string
  qty?: string
  unit_price?: string
  name?: string
  dosage_count?: string
  price?: string
  embalase?: string
  ingredients?: IngredientRow[]
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
  boxSizing: 'border-box',
}
const miniLabel: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: 2,
}

function emptyLine(kind: 'item' | 'racikan'): Line {
  return kind === 'item'
    ? { kind, product_id: '', qty: '', unit_price: '' }
    : { kind, name: '', dosage_count: '', price: '', embalase: '', ingredients: [{ product_id: '', per_dose: '' }] }
}

export function CartBuilder({
  products,
  doctors,
  patients,
}: {
  products: ProductLite[]
  doctors: DoctorLite[]
  patients: PatientLite[]
}) {
  const [lines, setLines] = useState<Line[]>([emptyLine('item')])
  const [saleType, setSaleType] = useState<'OTC' | 'RESEP'>('OTC')
  const [tuslah, setTuslah] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [doctorSip, setDoctorSip] = useState('')
  const [patientId, setPatientId] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientAddress, setPatientAddress] = useState('')
  const [patientPhone, setPatientPhone] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productById = useMemo(() => {
    const m = new Map<string, ProductLite>()
    for (const p of products) m.set(p.id, p)
    return m
  }, [products])

  // Regulatory classes of everything in the cart (items + ingredients).
  const categories = useMemo(() => {
    const cats: RegulatoryCategory[] = []
    for (const line of lines) {
      if (line.kind === 'item' && line.product_id) {
        const p = productById.get(line.product_id)
        if (p) cats.push(p.regulatory_category)
      } else {
        for (const ing of line.ingredients || []) {
          if (ing.product_id) {
            const p = productById.get(ing.product_id)
            if (p) cats.push(p.regulatory_category)
          }
        }
      }
    }
    return cats
  }, [lines, productById])

  // Auto-flip: a KERAS/narcotic item forces the sale to RESEP.
  const forcedResep = requiresResep(categories)
  const effectiveType = forcedResep ? 'RESEP' : saleType
  const hardGate = effectiveType === 'RESEP' && requiresAddress(categories)

  const totals = useMemo(
    () => computeSaleTotals(lines as any[], Number(tuslah || 0)),
    [lines, tuslah]
  )

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function addIngredient(idx: number) {
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx ? { ...l, ingredients: [...(l.ingredients || []), { product_id: '', per_dose: '' }] } : l
      )
    )
  }

  function removeLine(idx: number) {
    setLines((ls) => (ls.length === 1 ? [emptyLine(ls[0].kind)] : ls.filter((_, i) => i !== idx)))
  }

  function submit(formData: FormData) {
    // Client-side sanity on the hard gate before submitting.
    if (effectiveType === 'RESEP') {
      const doctorOk = Boolean(doctorId || doctorName.trim())
      const patientOk = Boolean(patientId || patientName.trim())
      if (!doctorOk || !patientOk) {
        setError('A RESEP sale needs a doctor and a patient.')
        return
      }
      if (hardGate && !patientAddress.trim() && !(patientId && patientById.get(patientId)?.address)) {
        setError('Narcotic sales need the patient address.')
        return
      }
    }
    setError(null)
    formData.set('lines', JSON.stringify(lines))
    formData.set('sale_type', effectiveType)
    formData.set('tuslah', String(tuslah || 0))
    formData.set('doctor_id', effectiveType === 'RESEP' ? doctorId : '')
    formData.set('patient_id', effectiveType === 'RESEP' ? patientId : '')
    formData.set('doctor_name', effectiveType === 'RESEP' ? doctorName : '')
    formData.set('doctor_sip', doctorSip)
    formData.set('patient_name', effectiveType === 'RESEP' ? patientName : '')
    formData.set('patient_address', patientAddress)
    formData.set('patient_phone', patientPhone)
    createDraftSale(formData)
  }

  const patientById = useMemo(() => {
    const m = new Map<string, PatientLite>()
    for (const p of patients) m.set(p.id, p)
    return m
  }, [patients])

  return (
    <form
      action={createDraftSale}
      onSubmit={(e) => {
        e.preventDefault()
        submit(new FormData(e.currentTarget))
      }}
      style={{ background: 'var(--card)', padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 14, margin: 0 }}>Items</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine('item')])} style={addBtnStyle}>
            + Item
          </button>
          <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine('racikan')])} style={addBtnStyle}>
            + Racikan
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {lines.map((line, idx) => (
          <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12 }}>
            {line.kind === 'item' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.7fr 0.9fr auto', gap: 8 }}>
                <div>
                  <label style={miniLabel}>Product</label>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                    required
                    style={inputStyle}
                  >
                    <option value="">Select…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) — {p.regulatory_category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={miniLabel}>Qty</label>
                  <input
                    type="number"
                    value={line.qty}
                    onChange={(e) => updateLine(idx, { qty: e.target.value })}
                    required
                    min="0"
                    step={
                      line.product_id && !productById.get(line.product_id)?.allow_fractional
                        ? '1'
                        : '0.001'
                    }
                    placeholder="Qty"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={miniLabel}>Price</label>
                  <input
                    type="number"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    style={inputStyle}
                  />
                </div>
                <button type="button" onClick={() => removeLine(idx)} style={removeBtnStyle}>×</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.7fr 0.9fr 0.8fr auto', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={miniLabel}>Compound name</label>
                    <input
                      value={line.name}
                      onChange={(e) => updateLine(idx, { name: e.target.value })}
                      required
                      placeholder="Racikan Batuk Anak"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={miniLabel}>Dosage count</label>
                    <input
                      type="number"
                      value={line.dosage_count}
                      onChange={(e) => updateLine(idx, { dosage_count: e.target.value })}
                      required
                      min="1"
                      step="1"
                      placeholder="10 kapsul"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={miniLabel}>Price (total)</label>
                    <input
                      type="number"
                      value={line.price}
                      onChange={(e) => updateLine(idx, { price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      placeholder="50000"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={miniLabel}>Embalase</label>
                    <input
                      type="number"
                      value={line.embalase}
                      onChange={(e) => updateLine(idx, { embalase: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="3000"
                      style={inputStyle}
                    />
                  </div>
                  <button type="button" onClick={() => removeLine(idx)} style={removeBtnStyle}>×</button>
                </div>

                <label style={{ ...miniLabel, marginBottom: 4 }}>Ingredients (per dose)</label>
                {(line.ingredients || []).map((ing, ingIdx) => {
                  const totalQty = ingredientTotalQty(
                    Number(ing.per_dose || 0),
                    Number(line.dosage_count || 0)
                  )
                  return (
                    <div key={ingIdx} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr auto', gap: 8, marginBottom: 6 }}>
                      <select
                        value={ing.product_id}
                        onChange={(e) => {
                          const ings = [...(line.ingredients || [])]
                          ings[ingIdx] = { ...ings[ingIdx], product_id: e.target.value }
                          updateLine(idx, { ingredients: ings })
                        }}
                        style={inputStyle}
                      >
                        <option value="">Ingredient…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={ing.per_dose}
                        onChange={(e) => {
                          const ings = [...(line.ingredients || [])]
                          ings[ingIdx] = { ...ings[ingIdx], per_dose: e.target.value }
                          updateLine(idx, { ingredients: ings })
                        }}
                        required
                        min="0"
                        step="0.001"
                        placeholder="per dose (0.5)"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        total: {totalQty}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const ings = (line.ingredients || []).filter((_, i) => i !== ingIdx)
                          updateLine(idx, { ingredients: ings })
                        }}
                        style={removeBtnStyle}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
                <button type="button" onClick={() => addIngredient(idx)} style={addBtnStyle}>
                  + Ingredient
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sale type + fees */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
        <div>
          <label style={miniLabel}>Sale type</label>
          <select
            value={effectiveType}
            disabled={forcedResep}
            onChange={(e) => setSaleType(e.target.value as 'OTC' | 'RESEP')}
            style={inputStyle}
          >
            <option value="OTC">OTC</option>
            <option value="RESEP">Resep</option>
          </select>
          {forcedResep && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
              Forced RESEP — cart contains KERAS/narcotic item.
            </div>
          )}
        </div>
        <div>
          <label style={miniLabel}>Tuslah</label>
          <input
            type="number"
            value={tuslah}
            onChange={(e) => setTuslah(e.target.value)}
            min="0"
            step="0.01"
            placeholder="0"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Subtotal {totals.subtotal.toFixed(2)} + Embalase {totals.embalaseTotal.toFixed(2)} + Tuslah{' '}
              {Number(tuslah || 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Rp {totals.grandTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Prescription metadata — only for RESEP sales */}
      {effectiveType === 'RESEP' ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginTop: 16 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Prescription ({hardGate ? 'hard gate — address required' : 'doctor + patient'})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={miniLabel}>Doctor</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} style={inputStyle}>
                <option value="">— pick existing —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.sip_number ? ` (${d.sip_number})` : ''}
                  </option>
                ))}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="or new doctor name"
                  style={inputStyle}
                />
                <input
                  value={doctorSip}
                  onChange={(e) => setDoctorSip(e.target.value)}
                  placeholder="SIP number"
                  style={inputStyle}
                />
              </div>
            </div>
            <div>
              <label style={miniLabel}>Patient</label>
              <select value={patientId} onChange={(e) => setPatientId(e.target.value)} style={inputStyle}>
                <option value="">— pick existing —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="or new patient name"
                  style={inputStyle}
                />
                <input
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="phone"
                  style={inputStyle}
                />
              </div>
              {hardGate ? (
                <input
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  placeholder="Patient address (required)"
                  style={{ ...inputStyle, marginTop: 6 }}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <p style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginTop: 12 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        style={{
          marginTop: 16,
          background: 'var(--primary)',
          color: '#fff',
          padding: '8px 16px',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        Create Draft Sale
      </button>
    </form>
  )
}

const addBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--primary)',
  border: '1px solid var(--primary)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
}

const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#ef4444',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 14,
  cursor: 'pointer',
}