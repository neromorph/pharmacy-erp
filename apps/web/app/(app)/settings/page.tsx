import { createClient } from '../../../utils/supabase/server'
import { getUserRole, ROLE_LABELS } from '../../../utils/auth'
import { SettingsForm } from './settings-form'
import type { TenantProfile } from '../../../lib/settings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)

  if (role !== 'OWNER') {
    return (
      <div className="mx-auto mt-10 max-w-[480px] text-center">
        <p className="text-sm text-slate-500">Pengaturan hanya untuk Pemilik</p>
        <p className="mt-1 text-xs text-slate-400">{role ? ROLE_LABELS[role].hint : ''}</p>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return <p>No tenant context.</p>
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, address, phone, sia_number, sipa_number, logo_url, receipt_footer, satusehat_client_id, satusehat_org_id')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    return <p>Tenant not found.</p>
  }

  return (
    <section className="max-w-[560px] space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Pengaturan</h1>
      <SettingsForm tenant={tenant as TenantProfile} />
    </section>
  )
}