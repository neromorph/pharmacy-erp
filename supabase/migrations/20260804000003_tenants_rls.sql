-- Enable RLS on tenants. Profile data (SIA/SIPA, address, phone, logo)
-- is sensitive; only the owning tenant may read or write its own row.
-- Provisioning uses the service_role, which bypasses RLS.
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Tenant isolation via JWT claims. A signed-in user sees only the row
-- whose id equals their tenant_id.
CREATE POLICY "Tenant isolation for tenants"
    ON public.tenants
    FOR ALL
    USING (id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
    WITH CHECK (id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
