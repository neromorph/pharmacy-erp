import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import { getSatusehatToken, needsTokenRefresh } from '../../../../lib/satusehat'

// Retry delays in minutes for attempts 1, 2, 3 (ticket 06).
// Attempt 4 fails the row.
const RETRY_DELAYS_MIN = [2, 8, 32]
const BATCH_SIZE = 10

// Called by pg_cron every 60 seconds via pg_net.http_post.
// Gate: x-cron-secret header must match CRON_SECRET.
export async function GET(request: Request) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const summary = { processed: 0, skipped: 0, failed: 0, errored: 0 }

  const { data: due, error: readError } = await admin
    .from('satusehat_submissions')
    .select('*')
    .eq('status', 'PENDING')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  for (const row of due || []) {
    try {
      summary.processed += 1

      // Load tenant credentials.
      const { data: tenant } = await admin
        .from('tenants')
        .select('satusehat_client_id, satusehat_client_secret, satusehat_org_id')
        .eq('id', row.tenant_id)
        .single()

      if (!tenant?.satusehat_client_id || !tenant?.satusehat_client_secret) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'FAILED', last_error: 'SATUSEHAT credentials not set' })
          .eq('id', row.id)
        summary.failed += 1
        continue
      }

      // Token with cache.
      const { data: cached } = await admin
        .from('satusehat_tokens')
        .select('access_token, expires_at')
        .eq('tenant_id', row.tenant_id)
        .maybeSingle()

      let accessToken = cached?.access_token ?? null
      if (!accessToken || needsTokenRefresh(new Date(cached!.expires_at))) {
        const token = await getSatusehatToken({
          clientId: tenant.satusehat_client_id,
          clientSecret: tenant.satusehat_client_secret,
        })
        accessToken = token.accessToken
        await admin.from('satusehat_tokens').upsert(
          {
            tenant_id: row.tenant_id,
            access_token: token.accessToken,
            expires_at: token.expiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id' }
        )
      }
      void accessToken // reserved for the FHIR payload builder (follow-up)

      // KFA validation: skip when no item has a KFA code.
      const { data: items } = await admin
        .from('sale_items')
        .select('products (kfa_code)')
        .eq('sale_id', row.sale_id)

      const hasKfa = (items || []).some(
        (it: any) => it.products && it.products.kfa_code
      )

      if (!hasKfa) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'SKIPPED', last_error: 'No items with KFA code' })
          .eq('id', row.id)
        summary.skipped += 1
        continue
      }

      // Stub: FHIR payload builder lands in a follow-up task.
      await admin
        .from('satusehat_submissions')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          last_error: 'FHIR payload builder pending (Task 5.5)',
        })
        .eq('id', row.id)
    } catch (err) {
      // Backoff per ticket 06: +2m, +8m, +32m, then FAILED.
      const attempt = Number(row.attempt_count || 0) + 1
      const message = err instanceof Error ? err.message : 'Unknown error'
      if (attempt >= 4) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'FAILED', attempt_count: attempt, last_error: message })
          .eq('id', row.id)
        summary.failed += 1
      } else {
        const delayMin = RETRY_DELAYS_MIN[attempt - 1] ?? 32
        const nextRetry = new Date(Date.now() + delayMin * 60_000).toISOString()
        await admin
          .from('satusehat_submissions')
          .update({
            attempt_count: attempt,
            last_error: message,
            next_retry_at: nextRetry,
          })
          .eq('id', row.id)
        summary.errored += 1
      }
    }
  }

  return NextResponse.json(summary)
}
