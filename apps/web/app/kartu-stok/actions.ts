'use server'

import { createClient } from '../../utils/supabase/server'
import { buildKartuStokRows, KartuStokRaw } from '../../lib/kartu-stok'

export interface KartuStokFilters {
  product_id?: string
  date_from?: string
  date_to?: string
  // TODO: regulatory_category filter — requires products.regulatory_category column (future task)
}

export async function getKartuStokFilters(): Promise<KartuStokFilters> {
  return {}
}

export async function getKartuStokRows(filters: KartuStokFilters = {}): Promise<{ rows: KartuStokRaw[]; hasAnchor: boolean; anchorOpnameId?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], hasAnchor: false }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { rows: [], hasAnchor: false }

  const rows: KartuStokRaw[] = []

  // Opening anchor — first APPROVED opname for this tenant
  const { data: anchorOpname } = await supabase
    .from('stock_opnames')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'APPROVED')
    .order('approved_at', { ascending: true })
    .limit(1)
    .single()

  if (!anchorOpname) {
    return { rows: [], hasAnchor: false }
  }

  const anchorOpnameId = anchorOpname.id

  // ADJUSTMENT from anchor opname items (saldo awal)
  const { data: anchorItems } = await supabase
    .from('stock_opname_items')
    .select('id, product_id, batch_id, variance_qty_base, created_at')
    .eq('tenant_id', tenantId)
    .eq('opname_id', anchorOpnameId)

  if (anchorItems) {
    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, batch_number, expiry_date')
      .in('id', anchorItems.map((i) => i.batch_id))
    const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

    for (const item of anchorItems) {
      const batch = batchMap.get(item.batch_id)
      rows.push({
        type: 'ADJUSTMENT',
        product_id: item.product_id,
        batch_number: batch?.batch_number ?? '',
        expiry_date: batch?.expiry_date ? String(batch.expiry_date) : null,
        qty: Number(item.variance_qty_base), // physical count = opening balance
        occurred_at: item.created_at,
        source_id: item.id,
      })
    }
  }

  // IN — goods_receipt_items
  let griQuery = supabase
    .from('goods_receipt_items')
    .select('id, product_id, batch_number, expiry_date, qty_received, created_at')
    .eq('tenant_id', tenantId)

  if (filters.product_id) griQuery = griQuery.eq('product_id', filters.product_id)
  if (filters.date_from) griQuery = griQuery.gte('created_at', filters.date_from)
  if (filters.date_to) griQuery = griQuery.lte('created_at', filters.date_to)

  const { data: griData } = await griQuery
  if (griData) {
    for (const item of griData) {
      rows.push({
        type: 'IN',
        product_id: item.product_id,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date ? String(item.expiry_date) : null,
        qty: Number(item.qty_received),
        occurred_at: item.created_at,
        source_id: item.id,
      })
    }
  }

  // OUT — sale_items from PAID sales
  let siQuery = supabase
    .from('sale_items')
    .select('id, product_id, batch_number, expiry_date, qty_sold, created_at, sale_id')
    .eq('tenant_id', tenantId)
    .not('product_batch_id', 'is', null)
    .eq('sales.status', 'PAID')

  if (filters.product_id) siQuery = siQuery.eq('product_id', filters.product_id)
  if (filters.date_from) siQuery = siQuery.gte('created_at', filters.date_from)
  if (filters.date_to) siQuery = siQuery.lte('created_at', filters.date_to)

  const { data: siData } = await siQuery
  if (siData) {
    for (const item of siData) {
      rows.push({
        type: 'OUT',
        product_id: item.product_id,
        batch_number: item.batch_number ?? '',
        expiry_date: item.expiry_date ? String(item.expiry_date) : null,
        qty: -Number(item.qty_sold), // negative because it reduces balance
        occurred_at: item.created_at,
        source_id: item.id,
      })
    }
  }

  // ADJUSTMENT — stock_opname_items from approved opnames AFTER the anchor
  let opQuery = supabase
    .from('stock_opnames')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'APPROVED')
    .gt('id', anchorOpnameId)

  const { data: laterOpnames } = await opQuery

  if (laterOpnames && laterOpnames.length > 0) {
    const { data: laterItems } = await supabase
      .from('stock_opname_items')
      .select('id, product_id, batch_id, variance_qty_base, created_at')
      .eq('tenant_id', tenantId)
      .in('opname_id', laterOpnames.map((o) => o.id))

    if (laterItems) {
      const { data: allBatches } = await supabase
        .from('product_batches')
        .select('id, batch_number, expiry_date')
        .in('id', laterItems.map((i) => i.batch_id))
      const batchMap2 = new Map((allBatches || []).map((b: any) => [b.id, b]))

      for (const item of laterItems) {
        const batch = batchMap2.get(item.batch_id)
        rows.push({
          type: 'ADJUSTMENT',
          product_id: item.product_id,
          batch_number: batch?.batch_number ?? '',
          expiry_date: batch?.expiry_date ? String(batch.expiry_date) : null,
          qty: Number(item.variance_qty_base),
          occurred_at: item.created_at,
          source_id: item.id,
        })
      }
    }
  }

  // VOID — sale_items from VOIDED sales (reverse sign)
  let voidQuery = supabase
    .from('sale_items')
    .select('id, product_id, batch_number, expiry_date, qty_sold, created_at')
    .eq('tenant_id', tenantId)
    .not('product_batch_id', 'is', null)
    .eq('sales.status', 'VOID')

  if (filters.product_id) voidQuery = voidQuery.eq('product_id', filters.product_id)
  if (filters.date_from) voidQuery = voidQuery.gte('created_at', filters.date_from)
  if (filters.date_to) voidQuery = voidQuery.lte('created_at', filters.date_to)

  const { data: voidData } = await voidQuery
  if (voidData) {
    for (const item of voidData) {
      // VOID restores stock, so sign is positive (opposite of OUT)
      rows.push({
        type: 'VOID',
        product_id: item.product_id,
        batch_number: item.batch_number ?? '',
        expiry_date: item.expiry_date ? String(item.expiry_date) : null,
        qty: Number(item.qty_sold), // positive — restores balance
        occurred_at: item.created_at,
        source_id: item.id,
      })
    }
  }

  // Sort by occurred_at then add running balance
  rows.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))

  return { rows, hasAnchor: true, anchorOpnameId }
}