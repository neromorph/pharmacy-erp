-- 20260804000006: racikan bundle — parent/child sale items + embalase
-- Resep Dokter & Obat Racikan effort (ticket 04).

-- Parent compound rows carry no single product; children reference real products.
ALTER TABLE public.sale_items
    ALTER COLUMN product_id DROP NOT NULL;

-- Self-FK: a child row points up to its parent compound row.
-- Deleting the parent removes its children with it.
ALTER TABLE public.sale_items
    ADD COLUMN parent_item_id UUID REFERENCES public.sale_items(id) ON DELETE CASCADE;

-- Per-parent packaging fee (Q3 locked: children never carry embalase).
ALTER TABLE public.sale_items
    ADD COLUMN embalase_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- DB guard: only parent rows (no parent_item_id) may carry a fee.
ALTER TABLE public.sale_items
    ADD CONSTRAINT check_child_no_embalase
    CHECK (parent_item_id IS NULL OR embalase_amount = 0);
