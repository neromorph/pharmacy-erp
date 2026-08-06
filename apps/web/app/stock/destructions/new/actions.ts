'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'

// Create one destruction record and its items, then reduce batch stock.
// A destruction is a formal legal event with BAP. Only OWNER and
// PHARMACIST (APJ) can record it.
export async function createDestruction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')
  const role = user.app_metadata?.role
  if (role !== 'OWNER' && role !== 'PHARMACIST') throw new Error('OWNER or PHARMACIST only')

  const bapNumber = String(formData.get('bap_number') || '').trim()
  const bapDate = String(formData.get('bap_date') || '').trim()
  const witnessNames = String(formData.get('witness_names') || '').trim()
  const reason = String(formData.get('reason') || '').trim()

  if (!bapNumber || !bapDate || !witnessNames || !reason) {
    throw new Error('BAP number, BAP date, witnesses, and reason are required')
  }

  const productIds = formData.getAll('product_id')
  const batchIds = formData.getAll('batch_id')
  const qtys = formData.getAll('qty_destroyed').map(Number)
  if (productIds.length === 0) throw new Error('Add at least one item')
  if (qtys.some((q) => !Number.isFinite(q) || q <= 0)) throw new Error('Invalid quantity')

  // Load batches and guard qty <= current_qty (same pattern as purchase returns).
  const { data: batches } = await supabase
    .from('product_batches')
    .select('id, batch_number, expiry_date, current_qty')
    .in('id', [...new Set(batchIds.map(String))])
  if (!batches) throw new Error('Failed to load batches')
  const batchMap = new Map(batches.map((b) => [b.id, b]))
  for (let i = 0; i < batchIds.length; i++) {
    const batch = batchMap.get(String(batchIds[i]))
    if (!batch) throw new Error('Batch not found')
    if (qtys[i] > Number(batch.current_qty)) {
      throw new Error(`Destruction exceeds stock for batch ${batch.batch_number}`)
    }
  }

  const { data: header, error: hErr } = await supabase
    .from('stock_destructions')
    .insert({
      tenant_id: tenantId,
      bap_number: bapNumber,
      bap_date: bapDate,
      witness_names: witnessNames,
      reason,
      created_by: user.email || null,
      notes: String(formData.get('notes') || '').trim() || null,
    })
    .select()
    .single()
  if (hErr) throw new Error(hErr.message)

  const itemRows = productIds.map((pid, i) => {
    const batch = batchMap.get(String(batchIds[i]))!
    return {
      tenant_id: tenantId,
      stock_destruction_id: header.id,
      product_id: String(pid),
      batch_id: String(batchIds[i]),
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      qty_destroyed: qtys[i],
    }
  })
  const { error: iErr } = await supabase.from('stock_destruction_items').insert(itemRows)
  if (iErr) throw new Error(iErr.message)

  for (let i = 0; i < batchIds.length; i++) {
    const batch = batchMap.get(String(batchIds[i]))!
    const { error: uErr } = await supabase
      .from('product_batches')
      .update({ current_qty: Number(batch.current_qty) - qtys[i] })
      .eq('id', String(batchIds[i]))
    if (uErr) throw new Error(uErr.message)
  }

  redirect(`/stock/destructions/${header.id}`)
}
