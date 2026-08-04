-- Add display name for the shift owner (auth.users is not queryable via PostgREST).

ALTER TABLE public.shifts
    ADD COLUMN cashier_name TEXT;
