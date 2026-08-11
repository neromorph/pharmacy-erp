'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// Sign out the current device only. Other sessions stay active.
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
