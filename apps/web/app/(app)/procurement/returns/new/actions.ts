'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../../utils/supabase/server'

// Create one purchase return and its items, then reduce batch stock.
// The return acts as a supplier credit note; it never changes the
// original accounts_payables row.
export async function createPurchaseReturn(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const supplierId = String(formData.get('supplier_id') || '')
  const returnNumber = String(formData.get('return_number') || '').trim()
  const reason = String(formData.get('reason') || '').trim()
  const pbfCreditNoteNumber = String(formData.get('pbf_credit_note_number') || '').trim() || null
  const returnedAt = String(formData.get('returned_at') || new Date().toISOString())
  const notes = String(formData.get('notes') || '').trim() || null

  if (!supplierId) throw new Error('Missing supplier')
  if (!returnNumber) throw new Error('Missing return number')
  if (!reason) throw new Error('Missing reason')

  // Items arrive as parallel arrays (same pattern as the receive form).
  const productIds = formData.getAll('product_id')
  const batchIds = formData.getAll('batch_id')
  const qtyReturned = formData.getAll('qty_returned').map(Number)
  const unitCosts = formData.getAll('unit_cost').map(Number)

  if (productIds.length === 0) throw new Error('Add at least one item')

  const items = productIds.map((productId, i) => ({
    tenant_id: tenantId,
    product_id: String(productId),
    batch_id: String(batchIds[i] || ''),
    qty_returned: qtyReturned[i] || 0,
    unit_cost: unitCosts[i] || 0,
  }))

  const total = items.reduce((s, it) => s + it.qty_returned * it.unit_cost, 0)
  if (total <= 0) throw new Error('Return total must be positive')

  // Check stock before insert: qty_returned must not exceed batch qty.
  const batchIdsToCheck = [...new Set(items.map((it) => it.batch_id))]
  const { data: batches, error: batchErr } = await supabase
    .from('product_batches')
    .select('id, batch_number, expiry_date, current_qty')
    .in('id', batchIdsToCheck)
  if (batchErr || !batches) throw new Error('Failed to load batches')

  const batchMap = new Map(batches.map((b) => [b.id, b]))
  for (const it of items) {
    const batch = batchMap.get(it.batch_id)
    if (!batch) throw new Error('Batch not found')
    if (Number(it.qty_returned) > Number(batch.current_qty)) {
      throw new Error(`Return exceeds stock for batch ${batch.batch_number}`)
    }
  }

  // Insert header first, then items (matches the receive flow).
  const { data: header, error: hErr } = await supabase
    .from('purchase_returns')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      return_number: returnNumber,
      reason,
      pbf_credit_note_number: pbfCreditNoteNumber,
      total_amount: total,
      returned_at: returnedAt,
      notes,
    })
    .select()
    .single()
  if (hErr) throw new Error(hErr.message)

  const itemRows = items.map((it) => {
    const batch = batchMap.get(it.batch_id)!
    return {
      tenant_id: tenantId,
      purchase_return_id: header.id,
      product_id: it.product_id,
      batch_id: it.batch_id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      qty_returned: it.qty_returned,
      unit_cost: it.unit_cost,
      line_total: it.qty_returned * it.unit_cost,
    }
  })
  const { error: iErr } = await supabase.from('purchase_return_items').insert(itemRows)
  if (iErr) throw new Error(iErr.message)

  // Decrement each batch by the returned quantity.
  for (const it of items) {
    const { error: uErr } = await supabase
      .from('product_batches')
      .update({ current_qty: Number(batchMap.get(it.batch_id)!.current_qty) - it.qty_returned })
      .eq('id', it.batch_id)
    if (uErr) throw new Error(uErr.message)
  }

  redirect(`/procurement/returns/${header.id}`)
}
