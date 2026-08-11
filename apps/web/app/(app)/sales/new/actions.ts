'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { requireOpenShift } from '../../shifts/actions'
import { computeSaleTotals, requiresAddress, requiresResep, type RegulatoryCategory } from '../../../../lib/sale-cart'

// Upsert a doctor/patient. When a new record name is provided and no existing
// id, create it and return the new id. When given an existing id, return it.
async function resolveDoctor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  id: string | null,
  name: string | null,
  sipNumber: string | null
): Promise<string | null> {
  if (id) return id
  if (!name || !name.trim()) return null
  const { data, error } = await supabase
    .from('doctors')
    .insert({ tenant_id: tenantId, name: name.trim(), sip_number: sipNumber?.trim() || null })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function resolvePatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  id: string | null,
  name: string | null,
  address: string | null,
  phone: string | null
): Promise<string | null> {
  if (id) return id
  if (!name || !name.trim()) return null
  const { data, error } = await supabase
    .from('patients')
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function createDraftSale(formData: FormData) {
  const openShift = await requireOpenShift()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/sales/new?error=No tenant context')

  const linesJson = String(formData.get('lines') || '[]')
  let lines: {
    kind: 'item' | 'racikan'
    product_id?: string
    qty?: number
    unit_price?: number
    name?: string
    dosage_count?: number
    price?: number
    embalase?: number
    ingredients?: { product_id: string; per_dose: number }[]
  }[]

  try {
    lines = JSON.parse(linesJson)
  } catch {
    redirect('/sales/new?error=Invalid cart')
    return
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    redirect('/sales/new?error=Add at least one item')
    return
  }

  const saleTypeRaw = String(formData.get('sale_type') || 'OTC')
  const saleType = saleTypeRaw === 'RESEP' || saleTypeRaw === 'BPJS' || saleTypeRaw === 'SARANA' ? saleTypeRaw : 'OTC'
  const doctorId = String(formData.get('doctor_id') || '') || null
  const patientId = String(formData.get('patient_id') || '') || null
  const doctorName = String(formData.get('doctor_name') || '') || null
  const doctorSip = String(formData.get('doctor_sip') || '') || null
  const patientName = String(formData.get('patient_name') || '') || null
  const patientAddress = String(formData.get('patient_address') || '') || null
  const patientPhone = String(formData.get('patient_phone') || '') || null
  const tuslah = Number(formData.get('tuslah') || 0) || 0

  // Collect the real product ids from the cart to resolve regulatory classes.
  const realProductIds = new Set<string>()
  for (const line of lines) {
    if (line.kind === 'item' && line.product_id) realProductIds.add(line.product_id)
    for (const ing of line.ingredients || []) {
      if (ing.product_id) realProductIds.add(ing.product_id)
    }
  }

  let categories: RegulatoryCategory[] = []
  if (realProductIds.size > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, regulatory_category')
      .in('id', [...realProductIds])
    categories = (products || []).map((p: any) => p.regulatory_category)
  }

  // Two-tiered gate: narcotic classes force RESEP (never an OTC sale).
  const forcedResep = requiresResep(categories)
  const finalSaleType = forcedResep ? 'RESEP' : saleType

  const resolvedDoctorId = finalSaleType === 'RESEP' || finalSaleType === 'BPJS'
    ? await resolveDoctor(supabase, tenantId, doctorId, doctorName, doctorSip)
    : null
  const resolvedPatientId = finalSaleType === 'RESEP' || finalSaleType === 'BPJS' || finalSaleType === 'SARANA'
    ? await resolvePatient(supabase, tenantId, patientId, patientName, patientAddress, patientPhone)
    : null

  // Hard gate at cart time: narcotic RESEP lines need the patient identity
  // and address. SARANA transfers carry a facility name, not an address.
  const needsAddress = requiresAddress(categories)
  if (finalSaleType === 'RESEP' && needsAddress && (!resolvedPatientId)) {
    redirect('/sales/new?error=Patient address required for narcotic sale')
    return
  }

  const { subtotal, embalaseTotal, grandTotal } = computeSaleTotals(lines, tuslah)

  const { data: sale, error: hErr } = await supabase
    .from('sales')
    .insert([
      {
        tenant_id: tenantId,
        sale_number: 'SALE-' + Date.now(),
        status: 'DRAFT',
        subtotal,
        embalase_amount: embalaseTotal,
        tuslah_amount: tuslah,
        grand_total: grandTotal,
        sale_type: finalSaleType,
        doctor_id: resolvedDoctorId,
        patient_id: resolvedPatientId,
        cashier_id: user?.id,
        shift_id: openShift.id,
      },
    ])
    .select('id')
    .single()

  if (hErr) {
    redirect('/sales/new?error=Failed to create sale')
    return
  }
  const saleId = sale.id

  const parentIds: string[] = [] // same order as racikan lines
  const itemRows: any[] = []
  for (const line of lines) {
    if (line.kind === 'item') {
      itemRows.push({
        tenant_id: tenantId,
        sale_id: saleId,
        product_id: line.product_id,
        qty_sold: Number(line.qty || 0),
        unit_price: Number(line.unit_price || 0),
        line_total: Number(line.qty || 0) * Number(line.unit_price || 0),
      })
    } else {
      // Parent compound row: product_id null, carries the compound name and
      // price. Its qty_sold is the dispensed dosage-unit count.
      itemRows.push({
        tenant_id: tenantId,
        sale_id: saleId,
        product_id: null,
        qty_sold: Number(line.dosage_count || 0),
        unit_price: Number(line.price || 0),
        line_total: Number(line.price || 0),
        embalase_amount: Number(line.embalase || 0),
        item_name: line.name?.trim() || null,
      })
    }
  }

  const { data: inserted, error: pErr } = await supabase
    .from('sale_items')
    .insert(itemRows)
    .select('id')
  if (pErr) {
    redirect('/sales/new?error=Failed to add items')
    return
  }
  const allIds = (inserted || []).map((r: any) => r.id)

  // Map parent ids back to their racikan lines. Item rows precede parents in
  // insertion order only for non-racikan lines; rebuild the parent association.
  let insertedIdx = 0
  const parentIdByLine: Record<number, string> = {}
  lines.forEach((line, idx) => {
    if (line.kind === 'item') {
      insertedIdx++
    } else {
      parentIdByLine[idx] = allIds[insertedIdx]
      insertedIdx++
    }
  })

  // Child rows per racikan: product_id real, unit_price 0, parent_item_id set,
  // qty = per-dose fraction x dosage count. Children carry no embalase.
  const children: any[] = []
  lines.forEach((line, lineIdx) => {
    if (line.kind !== 'racikan') return
    const parentId = parentIdByLine[lineIdx]
    if (!parentId) return
    const dosageCount = Number(line.dosage_count || 0)
    for (const ing of line.ingredients || []) {
      children.push({
        tenant_id: tenantId,
        sale_id: saleId,
        product_id: ing.product_id,
        parent_item_id: parentId,
        qty_sold: Number(ing.per_dose) * dosageCount,
        unit_price: 0,
        line_total: 0,
      })
    }
  })
  if (children.length > 0) {
    const { error: cErr } = await supabase.from('sale_items').insert(children)
    if (cErr) {
      redirect('/sales/new?error=Failed to add ingredients')
      return
    }
  }

  redirect(`/sales/${saleId}`)
}

export { createDraftSale }