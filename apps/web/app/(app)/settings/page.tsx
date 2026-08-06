import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { SettingsForm } from './settings-form'
import type { TenantProfile } from '../../../lib/settings'

export default async function SettingsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)

  if (role !== 'OWNER') {
    return (
      <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
        <p style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Settings: Owner only</p>
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
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>Store Settings</h1>
      <SettingsForm tenant={tenant as TenantProfile} />
    </div>
  )
}