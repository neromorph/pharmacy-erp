-- SATUSEHAT dispensing: store created resources for idempotent retry.
-- Safe to run on any database. All statements are idempotent.

ALTER TABLE public.satusehat_submissions
  ADD COLUMN IF NOT EXISTS location_id TEXT,
  ADD COLUMN IF NOT EXISTS encounter_id TEXT,
  ADD COLUMN IF NOT EXISTS condition_id TEXT,
  ADD COLUMN IF NOT EXISTS fhir_ids JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index for debugging / tenant-scoped lookups (optional, helps introspection)
CREATE INDEX IF NOT EXISTS satusehat_submissions_location_id_idx
  ON public.satusehat_submissions (location_id);
CREATE INDEX IF NOT EXISTS satusehat_submissions_encounter_id_idx
  ON public.satusehat_submissions (encounter_id);