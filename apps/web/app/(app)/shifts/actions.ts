'use server'

import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { parseOpeningCash } from '../../../lib/shifts'

export async function openShift(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST' && role !== 'CASHIER') {
    throw new Error('Not authorized')
  }

  const { value: openingCash, error: cashError } = parseOpeningCash(formData)
  if (cashError) throw new Error(cashError)

  // SAFETY: asserted value is validated before use or known from the source.
  const notes = (formData.get('notes') as string) || null
  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  // Display name for the shift owner (auth.users is not queryable via PostgREST).
  // SAFETY: user_metadata shape from Supabase; only name is read.
  const userMeta = user.user_metadata as { name?: string } | undefined
  const cashierName = (userMeta?.name?.trim()) || user.email || null

  // Reject if user already has an open shift.
  const { data: existing } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'OPEN')
    .maybeSingle()

  if (existing) throw new Error('Shift already open')

  const { error } = await supabase.from('shifts').insert({
    tenant_id: tenantId,
    user_id: user.id,
    status: 'OPEN',
    opening_cash: openingCash,
    notes,
    cashier_name: cashierName,
  })

  if (error) throw new Error(error.message)
}

export async function closeShift(shiftId: string, closingCash: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (Number.isNaN(closingCash) || closingCash < 0) throw new Error('Invalid closing cash')

  // Must be the shift owner.
  const { data: shift } = await supabase
    .from('shifts')
    .select('user_id, status')
    .eq('id', shiftId)
    .maybeSingle()

  if (!shift) throw new Error('Shift not found')
  if (shift.status !== 'OPEN') throw new Error('Shift is not open')
  if (shift.user_id !== user.id) throw new Error('Not your shift')

  // Block if draft sales exist.
  const { count } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('status', 'DRAFT')

  if (count && count > 0) throw new Error('Close blocked: draft sales exist')

  const { error } = await supabase
    .from('shifts')
    .update({ status: 'CLOSED', closing_cash: closingCash, closed_at: new Date().toISOString() })
    .eq('id', shiftId)

  if (error) throw new Error(error.message)
}

// Owner may close any open shift, even one owned by another cashier.
export async function forceCloseShift(shiftId: string, closingCash: number) {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')

  if (Number.isNaN(closingCash) || closingCash < 0) throw new Error('Invalid closing cash')

  const { data, error } = await supabase
    .from('shifts')
    .update({ status: 'FORCE_CLOSED', closing_cash: closingCash, closed_at: new Date().toISOString() })
    .eq('id', shiftId)
    .eq('status', 'OPEN')
    .select('id')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Shift not found or not open')
}

export async function listOpenShift() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'OPEN')
    .maybeSingle()

  return data
}

export async function requireOpenShift() {
  const openShift = await listOpenShift()
  if (!openShift) throw new Error('NO_OPEN_SHIFT')
  return openShift
}