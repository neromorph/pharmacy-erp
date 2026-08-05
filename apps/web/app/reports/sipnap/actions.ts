'use server'

import { createClient } from '../../../utils/supabase/server'

// Record one export run in the audit trail. The export itself is read-only.
export async function recordSipnapExport(input: {
  month: number
  year: number
  transactionCount: number
  productCount: number
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { error } = await supabase.from('sipnap_exports').insert({
    tenant_id: tenantId,
    report_month: input.month,
    report_year: input.year,
    transaction_count: input.transactionCount,
    product_count: input.productCount,
  })
  if (error) throw new Error(error.message)
}
