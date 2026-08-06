import { createClient } from '@supabase/supabase-js'

// Service-role client for server-only paths (cron worker, provisioning).
// Never use this in request paths that serve user data — RLS is bypassed.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
