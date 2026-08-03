import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function run() {
  const email = process.argv[2]
  const password = process.argv[3]
  const tenantName = process.argv[4]

  if (!email || !password || !tenantName) {
    console.error('Usage: tsx provision-tenant.ts <email> <password> <tenant-name>')
    process.exit(1)
  }

  // 1. Create Tenant (requires public.tenants table to exist)
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert([{ name: tenantName }])
    .select()
    .single()

  if (tErr) {
    console.error('Error creating tenant:', tErr)
    // Continue anyway if testing locally without DB setup yet
  }

  const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000000'
  console.log(`Tenant created/stubbed: ${tenantId}`)

  // 2. Create User
  const { data: user, error: uErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { tenant_id: tenantId, role: 'OWNER' },
  })

  if (uErr) {
    console.error('Error creating user:', uErr)
    process.exit(1)
  }

  console.log(`User created successfully with tenant_id: ${tenantId}`)
}

run()
