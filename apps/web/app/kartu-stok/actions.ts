'use server'

import { createClient } from '../../utils/supabase/server'
import { KartuStokRaw } from '../../lib/kartu-stok'

export interface KartuStokFilters {
  q?: string
  date_from?: string
  date_to?: string
  // TODO: regulatory_category filter — requires products.regulatory_category column (future task)
}

export async function getKartuStokFilters(): Promise<KartuStokFilters> {
  return {}
}

// Resolve a free-text search term to matching product ids, or null when the
// term matches nothing (callers should return an empty result set).
async function resolveProductIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  q: string | undefined
): Promise<string[] | null> {
  if (!q || !q.trim()) return null
  const term = q.trim()
  const { data } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
  if (!data || data.length === 0) return []
  return data.map((p) => p.id)
}

export async function getKartuStokRows(filters: KartuStokFilters = {}): Promise<{ rows: KartuStokRaw[]; hasAnchor: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { rows: [], hasAnchor: false }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { rows: [], hasAnchor: false }

  // Free-text product search resolves to ids; empty match means no rows.
  const productIds = await resolveProductIds(supabase, tenantId, filters.q)
  if (productIds && productIds.length === 0) {
    return { rows: [], hasAnchor: true }
  }

  const rows: KartuStokRaw[] = []

  // Opening anchor — all APPROVED opnames in approval order. The first one is
  // the saldo awal seed; the rest are ordinary ADJUSTMENT movements.
  const { data: approvedOpnames } = await supabase
    .from('stock_opnames')
    .select('id, approved_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'APPROVED')
    .order('approved_at', { ascending: true, nullsFirst: true })

  if (!approvedOpnames || approvedOpnames.length === 0) {
    return { rows: [], hasAnchor: false }
  }

  const [anchorOpname, ...laterOpnames] = approvedOpnames

  // Shared batch lookup for opname items.
  async function opnameRows(opnameIds: string[]): Promise<KartuStokRaw[]> {
    if (opnameIds.length === 0) return []
    const { data: items } = await supabase
      .from('stock_opname_items')
      .select('id, product_id, batch_id, variance_qty_base, created_at')
      .eq('tenant_id', tenantId)
      .in('opname_id', opnameIds)
    if (!items) return []

    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, batch_number, expiry_date')
      .in('id', items.map((i) => i.batch_id))
    const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

    return items.map((item) => {
      const batch = batchMap.get(item.batch_id)
      return {
        type: 'ADJUSTMENT' as const,
        product_id: item.product_id,
        batch_number: batch?.batch_number ?? '',
        expiry_date: batch?.expiry_date ? String(batch.expiry_date) : null,
        qty: Number(item.variance_qty_base),
        occurred_at: item.created_at,
        source_id: item.id,
      }
    })
  }

  // Saldo awal from the anchor opname items. The opening balance is the
  // physical count at go-live, not the variance (variance = system - physical).
  async function anchorRows(): Promise<KartuStokRaw[]> {
    const { data: items } = await supabase
      .from('stock_opname_items')
      .select('id, product_id, batch_id, physical_qty_base, created_at')
      .eq('tenant_id', tenantId)
      .eq('opname_id', anchorOpname.id)
    if (!items) return []

    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, batch_number, expiry_date')
      .in('id', items.map((i) => i.batch_id))
    const batchMap = new Map((batches || []).map((b: any) => [b.id, b]))

    return items.map((item) => {
      const batch = batchMap.get(item.batch_id)
      return {
        type: 'ADJUSTMENT' as const,
        product_id: item.product_id,
        batch_number: batch?.batch_number ?? '',
        expiry_date: batch?.expiry_date ? String(batch.expiry_date) : null,
        qty: Number(item.physical_qty_base),
        occurred_at: item.created_at,
        source_id: item.id,
      }
    })
  }

  rows.push(...(await anchorRows()))

  // ADJUSTMENT from later approved opnames (variance).
  rows.push(...(await opnameRows(laterOpnames.map((o) => o.id))))

  // IN — goods_receipt_items
  let griQuery = supabase
    .from('goods_receipt_items')
    .select('id, product_id, batch_number, expiry_date, qty_received, created_at')
    .eq('tenant_id', tenantId)

  if (productIds) griQuery = griQuery.in('product_id', productIds)
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
    .select('id, product_id, batch_number, expiry_date, qty_sold, created_at')
    .eq('tenant_id', tenantId)
    .not('product_batch_id', 'is', null)
    .eq('sales.status', 'PAID')

  if (productIds) siQuery = siQuery.in('product_id', productIds)
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

  // VOID — sale_items from VOIDED sales (reverse sign: restores stock)
  let voidQuery = supabase
    .from('sale_items')
    .select('id, product_id, batch_number, expiry_date, qty_sold, created_at')
    .eq('tenant_id', tenantId)
    .not('product_batch_id', 'is', null)
    .eq('sales.status', 'VOID')

  if (productIds) voidQuery = voidQuery.in('product_id', productIds)
  if (filters.date_from) voidQuery = voidQuery.gte('created_at', filters.date_from)
  if (filters.date_to) voidQuery = voidQuery.lte('created_at', filters.date_to)

  const { data: voidData } = await voidQuery
  if (voidData) {
    for (const item of voidData) {
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

  return { rows, hasAnchor: true }
}