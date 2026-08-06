-- ============================================================
-- Hotfix: staff sync trigger broke gotrue login (500 at sign-in).
--
-- Root cause 1: sync_staff_from_auth_users() ran as SECURITY
-- INVOKER. Gotrue connects to the database as supabase_auth_admin,
-- which has no grants on public.staff. Every login ended with
-- SQLSTATE 42501 (permission denied for table staff).
--
-- Root cause 2: the trigger listened to ALL auth.users updates.
-- A login only updates last_sign_in_at, but the trigger fired
-- anyway. Live verification through the supabase_admin role hid
-- the problem because that role holds the grants.
--
-- Fix: SECURITY DEFINER (function owner supabase_admin holds the
-- public.staff grants and bypasses RLS) and fire only on INSERT
-- or a metadata column change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_staff_from_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_name TEXT;
BEGIN
    v_tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::uuid;

    -- A user without tenant metadata has no staff row to mirror.
    IF v_tenant_id IS NULL THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Staff user must carry app_metadata.tenant_id (provisioning required)';
        END IF;
        RETURN NEW;
    END IF;

    v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'CASHIER');
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));

    INSERT INTO public.staff (id, tenant_id, email, name, role)
    VALUES (NEW.id, v_tenant_id, NEW.email, v_name, v_role)
    ON CONFLICT (id)
    DO UPDATE SET
        name  = EXCLUDED.name,
        role  = EXCLUDED.role,
        email = EXCLUDED.email;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS z_staff_sync_from_auth_users ON auth.users;
CREATE TRIGGER z_staff_sync_from_auth_users
AFTER INSERT OR UPDATE OF raw_app_meta_data, raw_user_meta_data, email
ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_staff_from_auth_users();
