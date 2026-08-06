'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'

// Re-queue a FAILED submission. OWNER and PHARMACIST only.
export async function retrySatusehatSubmission(saleId: string) {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    redirect(`/sales/${saleId}`)
    return
  }

  await supabase
    .from('satusehat_submissions')
    .update({
      status: 'PENDING',
      attempt_count: 0,
      next_retry_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('sale_id', saleId)

  redirect(`/sales/${saleId}`)
}
