import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../utils/supabase/admin'
import {
  buildContainedMedication,
  buildEncounter,
  buildLocation,
  buildMedicationDispense,
  buildMedicationRequest,
  getSatusehatToken,
  lookupPractitionerIhs,
  mapBaseUnitToOdf,
  needsTokenRefresh,
  postFhirResource,
} from '../../../../lib/satusehat'

// Retry delays in minutes for attempts 1, 2, 3 (ticket 06).
// Attempt 4 fails the row.
const RETRY_DELAYS_MIN = [2, 8, 32]
const BATCH_SIZE = 10

// Sandbox-seeded Condition. Production fills `condition_id` per tenant
// (Condition POST is blocked for the pharmacy access class, Rule 20004).
const FALLBACK_CONDITION_ID = '7725001a-d023-4e63-8d83-46be3d9dd4f7'
const FIVE_MINUTES_MS = 5 * 60_000

// SATUSEHAT FHIR base. Helper module reads SATUSEHAT_BASE_URL itself; the
// postFhirResource helper needs it explicitly, so derive it the same way.
const FHIR_BASE =
  process.env.SATUSEHAT_BASE_URL ?? 'https://api-satusehat-stg.dto.kemkes.go.id'

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
      // After the refresh block accessToken is always set.
      // SAFETY: asserted value is validated before use or known from the source.
      const token = accessToken as string

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

      if (!tenant?.satusehat_org_id) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'FAILED', last_error: 'SATUSEHAT org id not set' })
          .eq('id', row.id)
        summary.failed += 1
        continue
      }

      // Sale header for timestamps and references.
      const { data: sale } = await admin
        .from('sales')
        .select('sale_number, sold_at, patient_id, doctor_id')
        .eq('id', row.sale_id)
        .single()
      if (!sale) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'FAILED', last_error: 'Sale not found' })
          .eq('id', row.id)
        summary.failed += 1
        continue
      }

      // Patient IHS number.
      const { data: patient } = await admin
        .from('patients')
        .select('name, ihs_number')
        .eq('id', sale.patient_id)
        .maybeSingle()
      if (!patient?.ihs_number) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'SKIPPED', last_error: 'Patient has no IHS number' })
          .eq('id', row.id)
        summary.skipped += 1
        continue
      }

      // Doctor IHS number; look up from NIK when not cached.
      const { data: doctor } = await admin
        .from('doctors')
        .select('name, ihs_number, nik')
        .eq('id', sale.doctor_id)
        .maybeSingle()
      let doctorIhs = doctor?.ihs_number ?? null
      if (!doctorIhs && doctor?.nik) {
        doctorIhs = await lookupPractitionerIhs({
          token,
          nik: doctor.nik,
        })
        if (doctorIhs) {
          await admin
            .from('doctors')
            .update({ ihs_number: doctorIhs })
            .eq('id', sale.doctor_id)
        }
      }
      if (!doctorIhs) {
        await admin
          .from('satusehat_submissions')
          .update({ status: 'FAILED', last_error: 'Doctor has no IHS number' })
          .eq('id', row.id)
        summary.failed += 1
        continue
      }

      // Sale items with product info. Parents = rows without parent_item_id.
      const { data: rawItems } = await admin
        .from('sale_items')
        .select('id, product_id, parent_item_id, qty_sold, item_name, products (kfa_code, name, base_unit)')
        .eq('sale_id', row.sale_id)
      const allItems = rawItems || []
      const parents = allItems.filter((it: any) => !it.parent_item_id)

      // Racikan parents need every child to carry a KFA code.
      let compoundMissingKfa = false
      for (const p of parents) {
        if (p.product_id) continue
        const children = allItems.filter((it: any) => it.parent_item_id === p.id)
        if (
          children.some((c: any) => !(c.products && c.products.kfa_code))
        ) {
          compoundMissingKfa = true
          break
        }
      }
      if (compoundMissingKfa) {
        await admin
          .from('satusehat_submissions')
          .update({
            status: 'SKIPPED',
            last_error: 'Compound item lacks KFA code',
          })
          .eq('id', row.id)
        summary.skipped += 1
        continue
      }

      // Location (once per org, reused across retries).
      let locationId = row.location_id
      if (!locationId) {
        const { data: tenantRow } = await admin
          .from('tenants')
          .select('name')
          .eq('id', row.tenant_id)
          .single()
        locationId = await postFhirResource({
          token,
          baseUrl: FHIR_BASE,
          // SAFETY: asserted value is validated before use or known from the source.
          resource: buildLocation({
            orgId: tenant.satusehat_org_id,
            name: tenantRow?.name ?? 'Apotek',
          }) as { resourceType: string },
        })
        await admin
          .from('satusehat_submissions')
          .update({ location_id: locationId })
          .eq('id', row.id)
      }

      // Encounter (once per sale, reused across retries).
      let encounterId = row.encounter_id
      const soldAt = new Date(sale.sold_at || Date.now())
      if (!encounterId) {
        const start = new Date(soldAt.getTime() - FIVE_MINUTES_MS).toISOString()
        const end = new Date(soldAt.getTime() + FIVE_MINUTES_MS).toISOString()
        encounterId = await postFhirResource({
          token,
          baseUrl: FHIR_BASE,
          // SAFETY: asserted value is validated before use or known from the source.
          resource: buildEncounter({
            orgId: tenant.satusehat_org_id,
            localId: sale.sale_number,
            patientIhs: patient.ihs_number,
            patientName: patient.name,
            doctorIhs,
            locationId,
            conditionId: row.condition_id || FALLBACK_CONDITION_ID,
            start,
            end,
          }) as { resourceType: string },
        })
        await admin
          .from('satusehat_submissions')
          .update({ encounter_id: encounterId })
          .eq('id', row.id)
      }

      // Per drug line: MedicationRequest + MedicationDispense.
      // SAFETY: row.fhir_ids is a JSON object or null from the DB.
      const fhirIds = (row.fhir_ids as Record<string, { medication_request: string; medication_dispense: string }> | null) ?? {}
      let itemIdx = 0
      for (const parent of parents) {
        itemIdx += 1
        // SAFETY: asserted value is validated before use or known from the source.
        const product = parent.products as { kfa_code?: string | null; name?: string | null; base_unit?: string | null } | null
        const productName = parent.item_name || product?.name || null
        const odf = mapBaseUnitToOdf(product?.base_unit)

        let medication
        if (parent.product_id) {
          medication = buildContainedMedication({
            orgId: tenant.satusehat_org_id,
            localId: `${sale.sale_number}-${itemIdx}-med`,
            kfaCode: product?.kfa_code,
            displayName: productName,
            baseUnit: product?.base_unit,
          })
        } else {
          const children = allItems.filter(
            (it: any) => it.parent_item_id === parent.id
          )
          medication = buildContainedMedication({
            orgId: tenant.satusehat_org_id,
            localId: `${sale.sale_number}-${itemIdx}-med`,
            displayName: productName,
            medicationType: 'EP',
            ingredients: children.map((c: any) => ({
              kfaCode: c.products?.kfa_code,
              displayName: c.item_name || c.products?.name || null,
            })),
          })
        }

        const medicationRequestId = await postFhirResource({
          token,
          baseUrl: FHIR_BASE,
          // SAFETY: asserted value is validated before use or known from the source.
          resource: buildMedicationRequest({
            orgId: tenant.satusehat_org_id,
            localId: `${sale.sale_number}-${itemIdx}`,
            medication,
            patientIhs: patient.ihs_number,
            encounterId,
            doctorIhs,
            authoredOn: soldAt.toISOString(),
          }) as { resourceType: string },
        })

        const medicationDispenseId = await postFhirResource({
          token,
          baseUrl: FHIR_BASE,
          // SAFETY: asserted value is validated before use or known from the source.
          resource: buildMedicationDispense({
            orgId: tenant.satusehat_org_id,
            localId: `${sale.sale_number}-${itemIdx}-disp`,
            medication,
            patientIhs: patient.ihs_number,
            encounterId,
            medicationRequestId,
            quantity: Number(parent.qty_sold),
            odfCode: odf,
            whenHandedOver: soldAt.toISOString(),
          }) as { resourceType: string },
        })

        fhirIds[parent.id] = {
          medication_request: medicationRequestId,
          medication_dispense: medicationDispenseId,
        }
      }

      await admin
        .from('satusehat_submissions')
        .update({
          status: 'SENT',
          sent_at: new Date().toISOString(),
          last_error: null,
          location_id: locationId,
          encounter_id: encounterId,
          condition_id: row.condition_id || FALLBACK_CONDITION_ID,
          fhir_ids: fhirIds,
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
