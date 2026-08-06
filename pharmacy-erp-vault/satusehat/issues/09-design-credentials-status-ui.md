# 09 — Design: credential storage + submission status UI

Type: grilling
Status: resolved

## Question

Two related design questions that share a data dependency on the async job design (ticket 06):

### A. Credential storage

How are the per-tenant SATUSEHAT credentials (`client_id`, `client_secret`, `org_id`) stored and retrieved?

1. **DB column**: add a `satusehat_config JSONB NULL` column to `tenants`, or three separate columns?
2. **Encryption**: should `client_secret` be encrypted at rest? If so, with what key (app-level secret in env var)?
3. **Settings UI**: what does the OWNER form look like — three fields (Client ID, Client Secret, Org ID) + a "Test connection" button?
4. **Retrieval in async job**: how does the submission job fetch credentials for the right tenant without exposing them?

### B. Submission status UI

Where and how does an OWNER/PHARMACIST see the status of past SATUSEHAT submissions?

1. **Location**: a new tab on `/reports`, a section on the sale detail page `/sales/[id]`, or inline badge on the sales list?
2. **Columns**: sale number, submitted_at, status (SENT / FAILED / SKIPPED / PENDING), last_error.
3. **Manual retry**: should a FAILED submission be re-triggerable from the UI?

## Answer

### A. Credential storage

Use **3 separate nullable columns** on tenant/settings table:

- `satusehat_client_id TEXT NULL`
- `satusehat_client_secret TEXT NULL`
- `satusehat_org_id TEXT NULL`

No JSONB blob.

**Encryption:** no custom encryption layer in v1. Store secret in DB, keep RLS tight, never send secret back to client.

**Settings UI:** OWNER form on `/settings` with 3 fields:
- Client ID
- Client Secret
- Org ID

Add a small **Test connection** button.

**Retrieval in async job:** the job reads queue row `tenant_id`, loads tenant settings server side, and uses the credentials only inside the worker path. No exposure to client.

### B. Submission status UI

**Location:** sale detail page first, at `/sales/[id]`.

**Columns shown:**
- `submitted_at`
- `status`
- `last_error`

Sale number already exists on the page. No separate inbox yet.

**Manual retry:** yes, OWNER/PHARMACIST only. Add a retry button on FAILED rows.

## Answer

- 3 columns, not JSONB.
- No encryption layer in v1.
- `/settings` gets 3 fields + Test connection.
- Job reads creds server side by tenant id.
- `/sales/[id]` shows status.
- FAILED rows can retry for OWNER/PHARMACIST.
