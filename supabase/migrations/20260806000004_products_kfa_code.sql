-- SATUSEHAT: KFA code on products (soft-gate for submission).
-- Idempotent. Research ticket 04: KFA code is required for non-racikan
-- Medication.code; products without a code are skipped from submission.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS kfa_code TEXT;
