import { createClient } from '@/utils/supabase/server'

export interface ShiftStatus {
  open: boolean
  openedAt: string | null
}

// Header dot status. Must be user-scoped like requireOpenShift: the POS gates
// on the current user's shift, so the chrome must describe the same state.
export async function getOpenShift(): Promise<ShiftStatus> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { open: false, openedAt: null }
  const { data } = await supabase
    .from('shifts')
    .select('status, opened_at')
    .eq('user_id', user.id)
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { open: !!data, openedAt: data?.opened_at ?? null }
}