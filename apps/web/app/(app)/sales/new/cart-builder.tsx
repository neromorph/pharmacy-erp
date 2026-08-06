'use client'

import { useMemo, useState } from 'react'
import { lookupIhsForPatient } from './ihs-actions'
import { createDraftSale } from './actions'
import {
  requiresAddress,
  requiresResep,
  computeSaleTotals,
  ingredientTotalQty,
  isBpjsCheckoutBlocked,
  RegulatoryCategory,
} from '../../../../lib/cart'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import { formatRupiah } from '@/lib/receipt'

interface ProductLite {
  id: string
  name: string
  sku: string
  base_unit: string
  allow_fractional: boolean
  regulatory_category: RegulatoryCategory
}

interface DoctorLite { id: string; name: string; sip_number: string | null }
interface PatientLite { id: string; name: string; address: string | null; bpjs_number: string | null; nik: string | null; ihs_number: string | null }

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

// Shared compact field styling (matches shadcn Input look).
const fieldCls =
  'h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
const labelCls = 'mb-0.5 block text-xs text-slate-500'

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
  const [saleType, setSaleType] = useState<'OTC' | 'RESEP' | 'BPJS' | 'SARANA'>('OTC')
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

  // patientById must be defined before bpjsBlocked (used in submit).
  const patientById = useMemo(() => {
    const m = new Map<string, PatientLite>()
    for (const p of patients) m.set(p.id, p)
    return m
  }, [patients])

  // BPJS Number Guard: cannot pay if the selected patient has no bpjs_number.
  const selectedPatient = patientId ? patientById.get(patientId) ?? null : null
  const bpjsBlocked = isBpjsCheckoutBlocked(effectiveType, selectedPatient)

  // SATUSEHAT IHS lookup status for the selected patient.
  const [ihsStatus, setIhsStatus] = useState<string | null>(null)

  async function handlePatientSelect(value: string) {
    setPatientId(value)
    if (effectiveType !== 'RESEP' && effectiveType !== 'BPJS') return
    const p = value ? patientById.get(value) : null
    if (!p?.nik || p.ihs_number) return
    setIhsStatus('SATUSEHAT: looking up IHS…')
    try {
      const res = await lookupIhsForPatient(value)
      if (res.ok) setIhsStatus('IHS OK')
      else setIhsStatus(res.message)
    } catch {
      setIhsStatus('SATUSEHAT lookup failed — sale can proceed.')
    }
  }

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
    if (effectiveType === 'SARANA') {
      const facilityOk = Boolean(patientId || patientName.trim())
      if (!facilityOk) {
        setError('A SARANA sale needs a facility name.')
        return
      }
    }
    if (effectiveType === 'BPJS') {
      const doctorOk = Boolean(doctorId || doctorName.trim())
      const patientOk = Boolean(patientId || patientName.trim())
      if (!doctorOk || !patientOk) {
        setError('A BPJS sale needs a doctor and a patient.')
        return
      }
      if (bpjsBlocked) {
        setError(`Patient is missing No. Peserta BPJS — update the patient record before processing a BPJS sale.`)
        return
      }
    }
    setError(null)
    formData.set('lines', JSON.stringify(lines))
    formData.set('sale_type', effectiveType)
    formData.set('tuslah', effectiveType === 'BPJS' ? '0' : String(tuslah || 0))
    formData.set('doctor_id', effectiveType === 'RESEP' || effectiveType === 'BPJS' ? doctorId : '')
    formData.set('patient_id', effectiveType === 'RESEP' || effectiveType === 'BPJS' || effectiveType === 'SARANA' ? patientId : '')
    formData.set('doctor_name', effectiveType === 'RESEP' || effectiveType === 'BPJS' ? doctorName : '')
    formData.set('doctor_sip', doctorSip)
    formData.set('patient_name', effectiveType === 'RESEP' || effectiveType === 'BPJS' || effectiveType === 'SARANA' ? patientName : '')
    formData.set('patient_address', patientAddress)
    formData.set('patient_phone', patientPhone)
    createDraftSale(formData)
  }

  return (
    <form
      action={createDraftSale}
      onSubmit={(e) => {
        e.preventDefault()
        submit(new FormData(e.currentTarget))
      }}
      className="rounded-xl bg-card py-4 ring-1 ring-foreground/10"
    >
      <div className="flex items-center justify-between px-4 pb-3">
        <h2 className="text-sm font-medium text-slate-900">Items</h2>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine('item')])}>
            + Item
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine('racikan')])}>
            + Racikan
          </Button>
        </div>
      </div>

      <div className="grid gap-3 px-4">
        {lines.map((line, idx) => (
          <div key={idx} className="rounded-lg border border-border p-3">
            {line.kind === 'item' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2.2fr_0.7fr_0.9fr_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <label htmlFor={`line-${idx}-product`} className={labelCls}>
                    Product
                  </label>
                  <select
                    id={`line-${idx}-product`}
                    value={line.product_id}
                    onChange={(e) => updateLine(idx, { product_id: e.target.value })}
                    required
                    className={fieldCls}
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
                  <label htmlFor={`line-${idx}-qty`} className={labelCls}>
                    Qty
                  </label>
                  <input
                    id={`line-${idx}-qty`}
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
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor={`line-${idx}-price`} className={labelCls}>
                    Price
                  </label>
                  <input
                    id={`line-${idx}-price`}
                    type="number"
                    value={line.unit_price}
                    onChange={(e) => updateLine(idx, { unit_price: e.target.value })}
                    required
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    className={fieldCls}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end text-destructive"
                  aria-label={`Remove item ${idx + 1}`}
                  onClick={() => removeLine(idx)}
                >
                  ×
                </Button>
              </div>
            ) : (
              <div>
                <div className="mb-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr_auto]">
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor={`line-${idx}-name`} className={labelCls}>
                      Compound name
                    </label>
                    <input
                      id={`line-${idx}-name`}
                      value={line.name}
                      onChange={(e) => updateLine(idx, { name: e.target.value })}
                      required
                      placeholder="Racikan Batuk Anak"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor={`line-${idx}-dosage`} className={labelCls}>
                      Dosage count
                    </label>
                    <input
                      id={`line-${idx}-dosage`}
                      type="number"
                      value={line.dosage_count}
                      onChange={(e) => updateLine(idx, { dosage_count: e.target.value })}
                      required
                      min="1"
                      step="1"
                      placeholder="10 kapsul"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor={`line-${idx}-rxprice`} className={labelCls}>
                      Price (total)
                    </label>
                    <input
                      id={`line-${idx}-rxprice`}
                      type="number"
                      value={line.price}
                      onChange={(e) => updateLine(idx, { price: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      placeholder="50000"
                      className={fieldCls}
                    />
                  </div>
                  <div>
                    <label htmlFor={`line-${idx}-embalase`} className={labelCls}>
                      Embalase
                    </label>
                    <input
                      id={`line-${idx}-embalase`}
                      type="number"
                      value={effectiveType === 'BPJS' ? '0' : (line.embalase ?? '')}
                      onChange={(e) => { if (effectiveType !== 'BPJS') updateLine(idx, { embalase: e.target.value }) }}
                      disabled={effectiveType === 'BPJS'}
                      min="0"
                      step="0.01"
                      placeholder="3000"
                      className={fieldCls}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-end text-destructive"
                    aria-label={`Remove compound ${idx + 1}`}
                    onClick={() => removeLine(idx)}
                  >
                    ×
                  </Button>
                </div>

                <label className={`${labelCls} mb-1`}>Ingredients (per dose)</label>
                {(line.ingredients || []).map((ing, ingIdx) => {
                  const totalQty = ingredientTotalQty(
                    Number(ing.per_dose || 0),
                    Number(line.dosage_count || 0)
                  )
                  return (
                    <div key={ingIdx} className="mb-1.5 grid grid-cols-2 gap-2 sm:grid-cols-[2fr_0.8fr_1fr_auto]">
                      <select
                        aria-label={`Ingredient ${ingIdx + 1} product`}
                        value={ing.product_id}
                        onChange={(e) => {
                          const ings = [...(line.ingredients || [])]
                          ings[ingIdx] = { ...ings[ingIdx], product_id: e.target.value }
                          updateLine(idx, { ingredients: ings })
                        }}
                        className={`col-span-2 ${fieldCls} sm:col-span-1`}
                      >
                        <option value="">Ingredient…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Ingredient ${ingIdx + 1} per dose`}
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
                        className={fieldCls}
                      />
                      <div className="flex items-center text-xs text-slate-500">
                        total: {totalQty}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        aria-label={`Remove ingredient ${ingIdx + 1}`}
                        onClick={() => {
                          const ings = (line.ingredients || []).filter((_, i) => i !== ingIdx)
                          updateLine(idx, { ingredients: ings })
                        }}
                      >
                        ×
                      </Button>
                    </div>
                  )
                })}
                <Button type="button" variant="outline" size="sm" onClick={() => addIngredient(idx)}>
                  + Ingredient
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sale type + fees */}
      <div className="mt-4 grid grid-cols-1 gap-3 px-4 sm:grid-cols-3">
        <div>
          <label htmlFor="sale-type" className={labelCls}>
            Sale type
          </label>
          <select
            id="sale-type"
            value={effectiveType}
            disabled={forcedResep}
            onChange={(e) => setSaleType(e.target.value as 'OTC' | 'RESEP' | 'BPJS' | 'SARANA')}
            className={fieldCls}
          >
            <option value="OTC">OTC</option>
            <option value="RESEP">Resep</option>
            <option value="BPJS">BPJS / JKN</option>
            <option value="SARANA">Sarana (facility)</option>
          </select>
          {effectiveType === 'BPJS' && (
            <span className="mt-1 inline-block rounded bg-emerald-700 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              BPJS — Tuslah &amp; Embalase waived (SE 031/XI/2014)
            </span>
          )}
          {forcedResep && (
            <div className="mt-1 text-[11px] text-red-700">
              Forced RESEP — cart contains KERAS/narcotic item.
            </div>
          )}
        </div>
        <div>
          <label htmlFor="tuslah" className={labelCls}>
            Tuslah
          </label>
          <input
            id="tuslah"
            type="number"
            value={effectiveType === 'BPJS' ? '0' : tuslah}
            onChange={(e) => { if (effectiveType !== 'BPJS') setTuslah(e.target.value) }}
            disabled={effectiveType === 'BPJS'}
            min="0"
            step="0.01"
            placeholder="0"
            className={fieldCls}
          />
        </div>
        <div className="flex items-end justify-end">
          <div className="text-right">
            <div className="text-xs text-slate-500">
              Subtotal {formatRupiah(totals.subtotal)} + Embalase {formatRupiah(totals.embalaseTotal)} + Tuslah{' '}
              {formatRupiah(Number(tuslah || 0))}
            </div>
            <div className="text-lg font-bold tabular-nums text-slate-900">
              {formatRupiah(totals.grandTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Prescription metadata — only for RESEP and BPJS sales */}
      {(effectiveType === 'RESEP' || effectiveType === 'BPJS') ? (
        <div className="mx-4 mt-4 rounded-lg border border-border p-3">
          <h3 className="mb-2.5 text-sm font-medium text-slate-900">
            Prescription ({hardGate ? 'hard gate — address required' : 'doctor + patient'})
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="doctor_id" className={labelCls}>
                Doctor
              </label>
              <select id="doctor_id" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={fieldCls}>
                <option value="">— pick existing —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.sip_number ? ` (${d.sip_number})` : ''}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  aria-label="New doctor name"
                  placeholder="or new doctor name"
                  className={fieldCls}
                />
                <input
                  value={doctorSip}
                  onChange={(e) => setDoctorSip(e.target.value)}
                  aria-label="SIP number"
                  placeholder="SIP number"
                  className={fieldCls}
                />
              </div>
            </div>
            <div>
              <label htmlFor="patient_id" className={labelCls}>
                Patient
              </label>
              <select id="patient_id" value={patientId} onChange={(e) => handlePatientSelect(e.target.value)} className={fieldCls}>
                <option value="">— pick existing —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  aria-label="New patient name"
                  placeholder="or new patient name"
                  className={fieldCls}
                />
                <input
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  aria-label="Patient phone"
                  placeholder="phone"
                  className={fieldCls}
                />
              </div>
              {hardGate ? (
                <input
                  value={patientAddress}
                  onChange={(e) => setPatientAddress(e.target.value)}
                  aria-label="Patient address"
                  placeholder="Patient address (required)"
                  className={`${fieldCls} mt-1.5`}
                />
              ) : null}
              {ihsStatus ? (
                <p className="mt-1.5 text-xs text-slate-500">{ihsStatus}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Facility metadata — only for SARANA sales */}
      {effectiveType === 'SARANA' ? (
        <div className="mx-4 mt-4 rounded-lg border border-border p-3">
          <h3 className="mb-2.5 text-sm font-medium text-slate-900">Facility (B2B transfer)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="facility_id" className={labelCls}>
                Facility
              </label>
              <select id="facility_id" value={patientId} onChange={(e) => setPatientId(e.target.value)} className={fieldCls}>
                <option value="">— pick existing —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  aria-label="New facility name"
                  placeholder="or new facility name"
                  className={fieldCls}
                />
                <input
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  aria-label="Facility phone"
                  placeholder="phone"
                  className={fieldCls}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="px-4 pt-4">
        <SubmitButton disabled={bpjsBlocked}>Create Draft Sale</SubmitButton>
        {bpjsBlocked && (
          <p className="mt-1 text-xs text-red-700">
            Patient is missing No. Peserta BPJS — update the patient record first.
          </p>
        )}
      </div>
    </form>
  )
}
