'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'

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
