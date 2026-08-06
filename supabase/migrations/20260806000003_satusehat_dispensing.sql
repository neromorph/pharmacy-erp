-- SATUSEHAT dispensing sync: credentials, cache, queue, trigger.
-- Safe to run on any database. All statements are idempotent.
-- Enqueue happens when a sale becomes PAID and its type is RESEP or BPJS.

-- ============================================================
-- 1. Tenant SATUSEHAT credentials (per-tenant; read only in server code)
-- ============================================================
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS satusehat_client_id TEXT,
  ADD COLUMN IF NOT EXISTS satusehat_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS satusehat_org_id TEXT;

-- ============================================================
-- 2. Patient and doctor identity for IHS lookups
-- ============================================================
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS ihs_number TEXT;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS nik TEXT,
  ADD COLUMN IF NOT EXISTS ihs_number TEXT;

-- ============================================================
-- 3. Token cache (one row per tenant, refreshed near expiry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.satusehat_tokens (
    tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.satusehat_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'satusehat_tokens'
          AND policyname = 'Tenant isolation for satusehat_tokens'
    ) THEN
        CREATE POLICY "Tenant isolation for satusehat_tokens" ON public.satusehat_tokens
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

-- ============================================================
-- 4. Submission queue (one row per sale)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.satusehat_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.satusehat_submissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'satusehat_submissions'
          AND policyname = 'Tenant isolation for satusehat_submissions'
    ) THEN
        CREATE POLICY "Tenant isolation for satusehat_submissions" ON public.satusehat_submissions
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS satusehat_submissions_sale_id_key
    ON public.satusehat_submissions (sale_id);
CREATE INDEX IF NOT EXISTS satusehat_submissions_due_idx
    ON public.satusehat_submissions (status, next_retry_at);

-- ============================================================
-- 5. Trigger: enqueue when a sale becomes PAID (RESEP or BPJS)
-- ============================================================
CREATE OR REPLACE FUNCTION public.enqueue_satusehat_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.satusehat_submissions (tenant_id, sale_id)
    VALUES (NEW.tenant_id, NEW.id)
    ON CONFLICT (sale_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_satusehat_enqueue_on_paid ON public.sales;
CREATE TRIGGER trg_satusehat_enqueue_on_paid
AFTER UPDATE OF status ON public.sales
FOR EACH ROW
WHEN (NEW.status = 'PAID'
      AND OLD.status IS DISTINCT FROM 'PAID'
      AND NEW.sale_type IN ('RESEP', 'BPJS'))
EXECUTE FUNCTION public.enqueue_satusehat_submission();
