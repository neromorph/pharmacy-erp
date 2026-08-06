# 06 — Design: async submission job architecture

Type: grilling
Status: resolved

## Question

The SATUSEHAT submission must fire after a sale is marked PAID without blocking the POS. Given the stack (Next.js App Router + Supabase self-hosted on a VPS — no managed queue service), what is the right async job mechanism?

This ticket resolves:

1. **Trigger**: how does a PAID sale enqueue a submission?
2. **Queue table schema**: what does `satusehat_submissions` look like?
3. **Retry strategy**: exponential backoff, max attempts, dead-letter marking.
4. **Token caching**: where is the OAuth2 access token stored between calls?
5. **SKIPPED logic**: when no items have KFA codes, how is that recorded and surfaced?

## Answer

### 1. Trigger

**DB trigger on `sales.status`** → insert row into `satusehat_submissions` when `status` transitions to `'PAID'` and `sale_type IN ('RESEP', 'BPJS')`. Guarantees transactional consistency: if the payment commits, the submission row exists — immune to Next.js process crashes.

`pg_cron` polls the queue every 60s via `pg_net.http_post` to the Next.js API route.

### 2. Queue table schema

```sql
CREATE TABLE satusehat_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  sale_id         UUID NOT NULL REFERENCES sales(id),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX satusehat_submissions_sale_id_key ON satusehat_submissions(sale_id);
CREATE INDEX satusehat_submissions_pending ON satusehat_submissions(next_retry_at)
  WHERE status = 'PENDING';
```

### 3. Token cache table schema

```sql
CREATE TABLE satusehat_tokens (
  tenant_id    UUID PRIMARY KEY REFERENCES tenants(id),
  access_token TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Check `expires_at - now() < 60s` before each submission; re-fetch if near or past expiry.

### 4. Submission processor

`GET /api/satusehat/process-queue` — internal Next.js API route, called by `pg_cron` every 60s via `pg_net.http_post`. Route logic:

1. `SELECT ... FOR UPDATE SKIP LOCKED WHERE status='PENDING' AND next_retry_at <= now() LIMIT 10`
2. For each row: resolve token (cache hit or re-fetch), build FHIR Bundle, POST to SATUSEHAT.
3. On 2xx: `status='SENT'`, `sent_at=now()`.
4. On error: increment `attempt_count`, compute `next_retry_at` (see below), write `last_error`.
5. After 4 failures: `status='FAILED'`.

The route is called by `pg_cron` with the Supabase service role key in the `Authorization` header to gate access.

### 5. Retry strategy

Exponential backoff via `next_retry_at`:

| Attempt | Delay after failure |
|---|---|
| 1 | +2 min |
| 2 | +8 min |
| 3 | +32 min |
| 4 → FAILED | — |

After 4 failures: `status = 'FAILED'`. Staff can see FAILED rows on the sale detail page; no auto-recovery (manual re-queue out of scope for v1).

### 6. SKIPPED logic

When the submission trigger fires but all sale items lack a KFA code:

- Row created with `status = 'SKIPPED'`, `last_error = 'No items with KFA code'`, `attempt_count = 0`.
- Sale detail page (`/sales/[id]`) shows a muted yellow badge "SATUSEHAT: Dilewati".
- Badge links to each product missing a KFA code (product detail page where staff can add it).
- Not an operational failure — no retry, no alert.

### 7. pg_cron setup

```sql
SELECT cron.schedule(
  'satusehat-process-queue',
  '* * * * *',  -- every minute
  $$SELECT net.http_post(
    url := 'https://pharmacy.nmrooms.biz.id/api/satusehat/process-queue',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}',
    body := '{}'
  )$$
);
```

`CRON_SECRET` env var gates the route. Only `pg_cron` (running inside the DB container) calls it.
