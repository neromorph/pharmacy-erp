'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { getPayableStatus } from '../../../../lib/accounts-payable'
import { splitPayout, applyCreditFifo } from '../../../../lib/purchase-returns'

// Record one payout against a payable, then refresh its balance and status.
// Unapplied supplier credit is applied first; the payment row stores the
// credit portion in credit_applied_amount.
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
    .select('supplier_id, receipt_total_amount, remaining_amount, due_date')
    .eq('id', payableId)
    .single()

  if (!payable) throw new Error('Payable not found')
  if (amount > Number(payable.remaining_amount)) {
    throw new Error('Amount exceeds remaining balance')
  }

  // Sum unapplied credit across the supplier's return credit notes.
  const { data: creditNotes } = await supabase
    .from('purchase_returns')
    .select('id, total_amount, applied_amount')
    .eq('supplier_id', payable.supplier_id)
    .order('returned_at', { ascending: true })

  const unappliedCredit = (creditNotes || []).reduce(
    (sum, note) => sum + (Number(note.total_amount || 0) - Number(note.applied_amount || 0)),
    0
  )

  const { creditApplied } = splitPayout(amount, unappliedCredit)

  const { error: insertError } = await supabase.from('accounts_payable_payments').insert({
    tenant_id: tenantId,
    accounts_payable_id: payableId,
    amount,
    method,
    notes,
    credit_applied_amount: creditApplied,
  })
  if (insertError) throw new Error(insertError.message)

  // Consume the applied credit from the oldest credit notes first.
  if (creditApplied > 0 && creditNotes && creditNotes.length > 0) {
    const updated = applyCreditFifo(
      creditNotes.map((n) => ({ id: n.id, total: Number(n.total_amount), applied: Number(n.applied_amount) })),
      creditApplied
    )
    for (const note of updated) {
      const original = creditNotes.find((n) => n.id === note.id)!
      if (Number(note.applied) !== Number(original.applied_amount)) {
        const { error: creditError } = await supabase
          .from('purchase_returns')
          .update({ applied_amount: note.applied, updated_at: new Date().toISOString() })
          .eq('id', note.id)
        if (creditError) throw new Error(creditError.message)
      }
    }
  }

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
