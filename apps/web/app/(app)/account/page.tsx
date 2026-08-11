import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AccountForm } from './account-form'

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) redirect('/login')

  return (
    <section className="max-w-[560px] space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Akun</h1>
      <AccountForm email={user.email} />
    </section>
  )
}
