-- Staff management: tenant-scoped mirror of auth.users.
-- auth.users is not queryable via PostgREST, so we keep a public.staff
-- row per employee. A trigger keeps it in sync on user create/update.

-- ============================================================
-- 1. Staff table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'CASHIER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT staff_role_check
        CHECK (role IN ('OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'))
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Read: all authenticated members of the same tenant can read the staff list.
-- Write: only the OWNER of the tenant can create or change staff rows.
-- NOTE: Postgres ORs all policies for a command type. A FOR ALL policy with
-- only a tenant check would let any member write. Split read from write so
-- the OWNER gate actually binds.
CREATE POLICY "Staff read" ON public.staff
    FOR SELECT
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Staff owner write" ON public.staff
    FOR ALL
    USING (
        tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
        AND (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'OWNER'
    )
    WITH CHECK (
        tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
        AND (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = 'OWNER'
    );

CREATE INDEX IF NOT EXISTS idx_staff_tenant_id ON public.staff (tenant_id);
CREATE INDEX IF NOT EXISTS idx_staff_role ON public.staff (role);
CREATE INDEX IF NOT EXISTS idx_staff_is_active ON public.staff (is_active);

-- ============================================================
-- 2. Sync trigger from auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_staff_from_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_name TEXT;
BEGIN
    -- Extract tenant_id and role from raw_app_meta_data (JSONB).
    v_tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::uuid;
    v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'CASHIER');
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.staff (id, tenant_id, email, name, role, is_active)
        VALUES (NEW.id, v_tenant_id, NEW.email, v_name, v_role, TRUE)
        ON CONFLICT (id) DO UPDATE
            SET email = EXCLUDED.email,
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                tenant_id = EXCLUDED.tenant_id,
                updated_at = NOW();
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE public.staff
        SET email = NEW.email,
            name = v_name,
            role = v_role,
            tenant_id = v_tenant_id,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_sync_from_auth_users ON auth.users;
CREATE TRIGGER trg_staff_sync_from_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_from_auth_users();

-- ============================================================
-- 3. Self-modification guard
-- ============================================================
-- A user may not deactivate themselves or change their own role.
-- This prevents an Owner from accidentally locking themselves out.
CREATE OR REPLACE FUNCTION public.prevent_staff_self_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.id = auth.uid()
       AND (NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.role IS DISTINCT FROM OLD.role) THEN
        RAISE EXCEPTION 'You cannot change your own role or active status.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_staff_prevent_self_modification ON public.staff;
CREATE TRIGGER trg_staff_prevent_self_modification
BEFORE UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.prevent_staff_self_modification();

-- ============================================================
-- 4. Backfill existing auth users
-- ============================================================
INSERT INTO public.staff (id, tenant_id, email, name, role, is_active)
SELECT
    u.id,
    (u.raw_app_meta_data ->> 'tenant_id')::uuid AS tenant_id,
    u.email,
    COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)) AS name,
    COALESCE(u.raw_app_meta_data ->> 'role', 'CASHIER') AS role,
    TRUE AS is_active
FROM auth.users u
WHERE (u.raw_app_meta_data ->> 'tenant_id')::uuid IS NOT NULL
ON CONFLICT (id) DO NOTHING;