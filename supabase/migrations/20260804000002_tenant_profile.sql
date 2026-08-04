-- Tenant profile columns + logo Storage bucket.

-- Profile columns on tenants.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sia_number TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sipa_number TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS receipt_footer TEXT;

-- Storage bucket for tenant logos.
INSERT INTO storage.buckets (id, name, public)
    VALUES ('tenant-logos', 'Tenant Logos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: only the tenant that owns the file can read/write it.
-- Path convention: {tenant_id}/{filename}.
CREATE POLICY "Tenant read own logos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')
    );

CREATE POLICY "Tenant upload own logo"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')
    );

CREATE POLICY "Tenant delete own logo"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'tenant-logos'
        AND (storage.foldername(name))[1] = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')
    );