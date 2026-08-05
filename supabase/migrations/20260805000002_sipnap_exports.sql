-- 20260805000002: sipnap export audit trail.
-- One row records one export run. Export stays idempotent (read-only);
-- the row is the audit evidence, not a lock.

CREATE TABLE IF NOT EXISTS public.sipnap_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    report_month INT NOT NULL,
    report_year INT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_count INT NOT NULL,
    product_count INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sipnap_exports_tenant_id ON public.sipnap_exports (tenant_id);

ALTER TABLE public.sipnap_exports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'sipnap_exports'
          AND policyname = 'Tenant isolation for sipnap_exports'
    ) THEN
        CREATE POLICY "Tenant isolation for sipnap_exports" ON public.sipnap_exports
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;
