import { createClient } from '@/utils/supabase/server'
import { Sidebar } from '@/components/shell/Sidebar'
import { TopHeader } from '@/components/shell/TopHeader'
import { getOpenShift } from '@/components/shell/shift'

// App shell: fixed sidebar (desktop), sticky header, main content.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const shift = await getOpenShift()
  const tenant = await supabase.from('tenants').select('name').limit(1).maybeSingle()

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col border-r bg-white">
        <Sidebar />
      </div>
      <div className="flex flex-col md:pl-64">
        <TopHeader
          user={{
            email: user?.email ?? null,
            role: (user?.app_metadata?.role as string | undefined) ?? null,
          }}
          tenant={{ name: tenant?.data?.name ?? null }}
          shift={shift}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}