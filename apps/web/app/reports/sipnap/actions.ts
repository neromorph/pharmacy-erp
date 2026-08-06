'use server'

import { createHash } from 'crypto'
import { createClient } from '../../../utils/supabase/server'
import { buildSipnapV2Csv, type SipnapV2Report } from '../../../lib/sipnap-v2'

// Store the exact export CSV in the database (payload column) and record the
// audit row. Re-download always serves the stored file, never a recompute.
//
// Deviation from the map: the sipnap-archives Storage bucket is unusable on
// this deployment — storage-api v1.60.4 rejects every object with
// 'Invalid key ... must be a relative path' on both upload and version-delete
// (absolute /storage-single-tenant/ path bug). The DB payload keeps the same
// audit property (exact, immutable, never recomputed). Follow up: fix or
// upgrade the storage-api container, then switch back to the bucket.
export async function recordSipnapExport(report: SipnapV2Report): Promise<{ ok: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const csv = buildSipnapV2Csv(report)
  const fileHash = createHash('sha256').update(csv, 'utf8').digest('hex')

  const { error } = await supabase.from('sipnap_exports').insert({
    tenant_id: tenantId,
    report_month: report.month,
    report_year: report.year,
    transaction_count: report.transactions.length,
    product_count: report.products.length,
    generated_by: user.email || null,
    file_hash: fileHash,
    payload: { csv, products: report.products },
  })
  if (error) throw new Error(error.message)

  return { ok: true }
}

// One stored snapshot CSV for a history row. Served from the DB payload.
export async function getStoredExport(id: string): Promise<{ csv: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: row } = await supabase
    .from('sipnap_exports')
    .select('payload')
    .eq('id', id)
    .single()
  const csv = row?.payload?.csv
  if (!csv) throw new Error('Export file not found')

  return { csv }
}
