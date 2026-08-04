-- 20260804000007: compound display name on sale items
-- Resep Dokter & Obat Racikan effort (ticket 05).

-- Parent compound rows carry a display name (product_id is null). Plain items
-- leave this null and render their product name instead.
ALTER TABLE public.sale_items
    ADD COLUMN item_name TEXT;