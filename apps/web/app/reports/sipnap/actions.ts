'use server'

import { createHash } from 'crypto'
import { createClient } from '../../../utils/supabase/server'
import { buildSipnapV2Csv, type SipnapV2Report } from '../../../lib/sipnap-v2'

// Store the exact export CSV in the private sipnap-archives bucket and record
// the audit row. Re-download always serves the stored file, never a recompute.
// The DB payload (csv) is kept as a fallback for rows created while the bucket
// was broken (storage-api < 1.68.7 on this deployment).
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
  const fileName = `${tenantId}/${report.year}-${String(report.month).padStart(2, '0')}-${Date.now()}.csv`

  let storageUrl: string | null = null
  const { error: upErr } = await supabase.storage
    .from('sipnap-archives')
    .upload(fileName, new Blob([csv], { type: 'text/csv' }), {
      contentType: 'text/csv',
      upsert: true,
    })
  if (!upErr) storageUrl = fileName

  const { error } = await supabase.from('sipnap_exports').insert({
    tenant_id: tenantId,
    report_month: report.month,
    report_year: report.year,
    transaction_count: report.transactions.length,
    product_count: report.products.length,
    storage_url: storageUrl,
    generated_by: user.email || null,
    file_hash: fileHash,
    payload: { csv, products: report.products },
  })
  if (error) throw new Error(error.message)

  return { ok: true }
}

// One stored snapshot for a history row. Prefers the bucket file (signed URL),
// falls back to the DB payload csv for pre-fix rows.
export async function getStoredExport(id: string): Promise<{ url?: string; csv?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: row } = await supabase
    .from('sipnap_exports')
    .select('storage_url, payload')
    .eq('id', id)
    .single()

  if (row?.storage_url) {
    const { data, error } = await supabase.storage
      .from('sipnap-archives')
      .createSignedUrl(row.storage_url, 60 * 5)
    if (!error && data) return { url: data.signedUrl }
  }

  const csv = row?.payload?.csv
  if (!csv) throw new Error('Export file not found')

  return { csv }
}
