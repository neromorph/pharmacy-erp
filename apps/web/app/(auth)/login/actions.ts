'use server'
import { redirect } from 'next/navigation'
import { createClient } from '../../../utils/supabase/server'

export async function login(formData: FormData) {
  // SAFETY: asserted value is validated before use or known from the source.
  const email = formData.get('email') as string
  // SAFETY: asserted value is validated before use or known from the source.
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=Invalid credentials')
  redirect('/')
}
