-- 20260804000004: product classification + fractional stock flags
-- Resep Dokter & Obat Racikan effort (ticket 02).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS allow_fractional BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS regulatory_category TEXT NOT NULL DEFAULT 'BEBAS'
    CHECK (regulatory_category IN ('BEBAS', 'BEBAS_TERBATAS', 'KERAS', 'PSIKOTROPIKA', 'NARKOTIKA'));
