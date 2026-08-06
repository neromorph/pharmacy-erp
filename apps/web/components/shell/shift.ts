import { createClient } from '@/utils/supabase/server'

export interface ShiftStatus {
  open: boolean
  openedAt: string | null
}

// Return the currently open shift's status for the shift-aware dot in the header.
export async function getOpenShift(): Promise<ShiftStatus> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('shifts')
    .select('status, opened_at')
    .eq('status', 'OPEN')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return { open: !!data, openedAt: data?.opened_at ?? null }
}