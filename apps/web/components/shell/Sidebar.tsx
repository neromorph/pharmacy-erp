import { createClient } from '@/utils/supabase/server'
import { Logo } from '@/components/brand/Logo'
import { SidebarNav } from './SidebarNav'

// Desktop sidebar: brand top, nav middle, tenant name footer.
export async function Sidebar() {
  const supabase = await createClient()
  const { data } = await supabase.from('tenants').select('name').limit(1).maybeSingle()

  return (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4">
        <Logo />
      </div>
      <SidebarNav />
      <div className="shrink-0 border-t border-slate-200 px-4 py-3">
        <p className="truncate text-xs text-slate-500">
          {data?.name ?? 'Pharmacy ERP'}
        </p>
      </div>
    </>
  )
}