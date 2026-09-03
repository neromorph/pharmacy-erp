-- Fix: admin-API provisioning inserts the auth.users row before gotrue
-- writes app_metadata. The INSERT branch saw a NULL tenant_id and raised
-- "Staff user must carry app_metadata.tenant_id", which aborted every
-- createUser call (gotrue 500 "Database error creating new user").
-- The staff row now syncs on the later metadata UPDATE instead; the
-- trigger already fires on UPDATE OF raw_app_meta_data.

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

    -- No tenant metadata yet: gotrue writes it in a later UPDATE, which
    -- fires this trigger again and creates the staff row then.
    IF v_tenant_id IS NULL THEN
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
