'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { canVoidSale, getUserRole } from '../../../../utils/auth'
import { perProductQuantities, sumEmbalase } from '../../../../lib/compound'

// Update doctor and patient on a paid RESEP sale. OWNER or PHARMACIST only.
export async function updateSaleClinicalInfo(formData: FormData) {
  const saleId = String(formData.get('sale_id') || '')
  const doctorId = String(formData.get('doctor_id') || '') || null
  const patientId = String(formData.get('patient_id') || '') || null

  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') redirect(`/sales/${saleId}`)

  const { data: sale } = await supabase
    .from('sales')
    .select('status, sale_type')
    .eq('id', saleId)
    .single()
  if (!sale || sale.status !== 'PAID' || sale.sale_type !== 'RESEP') {
    redirect(`/sales/${saleId}`)
    return
  }

  const { error } = await supabase
    .from('sales')
    .update({ doctor_id: doctorId, patient_id: patientId, updated_at: new Date().toISOString() })
    .eq('id', saleId)
  if (error) throw new Error(error.message)

  redirect(`/sales/${saleId}`)
}

export async function voidSaleAction(formData: FormData) {
  const id = String(formData.get('sale_id') || '')
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!canVoidSale(role)) redirect(`/sales/${id}`)

  const { data: sale } = await supabase
    .from('sales')
    .select('status')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'PAID') redirect(`/sales/${id}`)

  // Restore batch quantities for all sale items.
  const { data: items } = await supabase
    .from('sale_items')
    .select('product_batch_id, qty_sold')
    .eq('sale_id', id)

  for (const item of items || []) {
    if (!item.product_batch_id) continue
    const { data: batch } = await supabase
      .from('product_batches')
      .select('current_qty')
      .eq('id', item.product_batch_id)
      .single()
    if (batch) {
      await supabase
        .from('product_batches')
        .update({ current_qty: Number(batch.current_qty) + Number(item.qty_sold) })
        .eq('id', item.product_batch_id)
    }
  }

  await supabase
    .from('sales')
    .update({ status: 'VOID' })
    .eq('id', id)
  redirect(`/sales/${id}`)
}

const paymentMethods = ['CASH', 'CARD', 'TRANSFER', 'QRIS']

export async function paySale(formData: FormData) {
  const id = String(formData.get('sale_id') || '')
  const paymentMethod = String(formData.get('payment_method') || '')
  const paidAmount = Number(formData.get('paid_amount') || 0)
  if (!paymentMethods.includes(paymentMethod)) {
    redirect(`/sales/${id}?error=Invalid payment method`)
    return
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // SAFETY: tenant_id is set at provisioning and RLS scopes every query to it.
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const { data: sale } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'DRAFT') {
    redirect(`/sales/${id}`)
    return
  }

  // Hard block: a draft sale may only be paid inside the cashier's own open shift.
  const { data: openShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', user?.id)
    .eq('status', 'OPEN')
    .maybeSingle()
  if (!openShift || sale.shift_id !== openShift.id) {
    redirect(`/sales/${id}?error=No open shift for this sale`)
    return
  }

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', id)

  // FEFO allocation per product: oldest expiry first, then earliest created.
  // Parent compound rows (product_id null) never enter stock allocation.
  const perProduct = perProductQuantities(saleItems || [])

  const allocated: Record<string, { product_batch_id: string; qty: number }[]> = {}
  for (const [productId, qtyNeeded] of perProduct.entries()) {
    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, current_qty')
      .eq('product_id', productId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true })
      .order('created_at', { ascending: true })

    const allocations: { product_batch_id: string; qty: number }[] = []
    let remaining = qtyNeeded
    for (const batch of batches || []) {
      if (remaining <= 0) break
      const take = Math.min(Number(batch.current_qty), remaining)
      allocations.push({ product_batch_id: batch.id, qty: take })
      remaining -= take
    }
    if (remaining > 0) {
      redirect(`/sales/${id}?error=Insufficient stock`)
      return
    }
    allocated[productId] = allocations
  }

  // Backfill batch info on the product's sale_items rows.
  for (const [productId, allocs] of Object.entries(allocated)) {
    if (allocs.length === 0) continue
    const first = allocs[0]
    const { data: batch } = await supabase
      .from('product_batches')
      .select('batch_number, expiry_date')
      .eq('id', first.product_batch_id)
      .single()
    await supabase
      .from('sale_items')
      .update({
        product_batch_id: first.product_batch_id,
        batch_number: batch?.batch_number,
        expiry_date: batch?.expiry_date,
      })
      .eq('sale_id', id)
      .eq('product_id', productId)
  }

  // Deduct batch quantities.
  for (const allocs of Object.values(allocated)) {
    for ( const alloc of allocs) {
      const { data: batch } = await supabase
        .from('product_batches')
        .select('current_qty')
        .eq('id', alloc.product_batch_id)
        .single()
      if (batch) {
        const newQty = Number(batch.current_qty) - alloc.qty
        await supabase
          .from('product_batches')
          .update({ current_qty: newQty })
          .eq('id', alloc.product_batch_id)
      }
    }
  }

  const grandTotal = Number(sale.grand_total)
  const changeAmount = paidAmount - grandTotal

  // Aggregate per-parent embalase fees into the sale total (Q3 locked).
  const embalaseTotal = sumEmbalase(saleItems || [])

  await supabase.from('sale_payments').insert([
    {
      tenant_id: tenantId,
      sale_id: id,
      payment_method: paymentMethod,
      amount: paidAmount,
    },
  ])

  await supabase
    .from('sales')
    .update({
      status: 'PAID',
      paid_amount: paidAmount,
      change_amount: changeAmount,
      embalase_amount: embalaseTotal,
      sold_at: new Date().toISOString(),
    })
    .eq('id', id)

  redirect(`/sales/${id}`)
}
