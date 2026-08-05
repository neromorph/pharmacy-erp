'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'
import { getPayableStatus } from '../../../lib/accounts-payable'

// Record one payout against a payable, then refresh its balance and status.
export async function postPayout(formData: FormData) {
  const payableId = String(formData.get('accounts_payable_id') || '')
  const amount = Number(formData.get('amount') || 0)
  const method = String(formData.get('method') || '').trim()
  const notes = String(formData.get('notes') || '').trim() || null

  if (!payableId) throw new Error('Missing payable')
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount')
  if (!method) throw new Error('Missing payment method')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { data: payable } = await supabase
    .from('accounts_payables')
    .select('receipt_total_amount, remaining_amount, due_date')
    .eq('id', payableId)
    .single()

  if (!payable) throw new Error('Payable not found')
  if (amount > Number(payable.remaining_amount)) {
    throw new Error('Amount exceeds remaining balance')
  }

  const { error: insertError } = await supabase.from('accounts_payable_payments').insert({
    tenant_id: tenantId,
    accounts_payable_id: payableId,
    amount,
    method,
    notes,
  })
  if (insertError) throw new Error(insertError.message)

  // Recompute paid and remaining amounts from the payment history.
  const { data: payments } = await supabase
    .from('accounts_payable_payments')
    .select('amount')
    .eq('accounts_payable_id', payableId)

  const paidAmount = (payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const remainingAmount = Number(payable.receipt_total_amount) - paidAmount
  const status = getPayableStatus({
    paidAmount,
    remainingAmount,
    dueDate: payable.due_date,
    now: new Date().toISOString(),
  })

  const { error: updateError } = await supabase
    .from('accounts_payables')
    .update({
      paid_amount: paidAmount,
      remaining_amount: remainingAmount,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payableId)

  if (updateError) throw new Error(updateError.message)

  redirect('/finance/payables')
}
