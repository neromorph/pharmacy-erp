-- AP v1 follow-up: auto-create accounts_payables from goods_receipts.
-- This file is safe to run on any database. The guards make it a no-op
-- when the AP schema already exists (fresh install via
-- 20250803000000_create_master_data.sql).

-- ============================================================
-- AP schema (guarded; mirrors 20250803000000_create_master_data.sql)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'accounts_payable_status' AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.accounts_payable_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.accounts_payables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL,
    receipt_total_amount NUMERIC(18,2) NOT NULL,
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(18,2) NOT NULL,
    due_date DATE NOT NULL,
    status public.accounts_payable_status NOT NULL DEFAULT 'UNPAID',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (goods_receipt_id)
);

CREATE TABLE IF NOT EXISTS public.accounts_payable_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    accounts_payable_id UUID NOT NULL REFERENCES public.accounts_payables(id) ON DELETE CASCADE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount NUMERIC(18,2) NOT NULL,
    method TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.accounts_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'accounts_payables'
          AND policyname = 'Tenant isolation for accounts_payables'
    ) THEN
        CREATE POLICY "Tenant isolation for accounts_payables" ON public.accounts_payables
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'accounts_payable_payments'
          AND policyname = 'Tenant isolation for accounts_payable_payments'
    ) THEN
        CREATE POLICY "Tenant isolation for accounts_payable_payments" ON public.accounts_payable_payments
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounts_payables_tenant_id ON public.accounts_payables (tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payables_supplier_id ON public.accounts_payables (supplier_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payables_due_date ON public.accounts_payables (due_date);
CREATE INDEX IF NOT EXISTS idx_accounts_payables_status ON public.accounts_payables (status);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_payments_payable_id ON public.accounts_payable_payments (accounts_payable_id);

-- ============================================================
-- Triggers: one payable per receipt, total kept in sync
-- ============================================================
-- The app inserts the receipt header before its items. The header
-- trigger creates the payable shell, and the items trigger keeps
-- receipt_total_amount correct.

-- Create one payable per new goods receipt.
CREATE OR REPLACE FUNCTION public.create_payable_from_goods_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_supplier_id UUID;
    v_terms_days INT;
    v_total NUMERIC(18,2);
BEGIN
    SELECT po.supplier_id, s.payment_terms_days
    INTO v_supplier_id, v_terms_days
    FROM public.purchase_orders po
    JOIN public.suppliers s ON s.id = po.supplier_id
    WHERE po.id = NEW.purchase_order_id;

    SELECT COALESCE(SUM(gri.line_total), 0)
    INTO v_total
    FROM public.goods_receipt_items gri
    WHERE gri.goods_receipt_id = NEW.id;

    INSERT INTO public.accounts_payables (
        tenant_id, goods_receipt_id, supplier_id, invoice_number,
        receipt_total_amount, paid_amount, remaining_amount, due_date, status
    ) VALUES (
        NEW.tenant_id, NEW.id, v_supplier_id, NEW.invoice_number,
        v_total, 0, v_total,
        NEW.received_at::date + v_terms_days, 'UNPAID'
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goods_receipt_create_payable ON public.goods_receipts;
CREATE TRIGGER trg_goods_receipt_create_payable
AFTER INSERT ON public.goods_receipts
FOR EACH ROW
EXECUTE FUNCTION public.create_payable_from_goods_receipt();

-- Keep the payable total in sync when receipt items change.
CREATE OR REPLACE FUNCTION public.sync_payable_total_from_receipt_items()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_receipt_id UUID;
    v_total NUMERIC(18,2);
BEGIN
    v_receipt_id := COALESCE(NEW.goods_receipt_id, OLD.goods_receipt_id);

    SELECT COALESCE(SUM(gri.line_total), 0)
    INTO v_total
    FROM public.goods_receipt_items gri
    WHERE gri.goods_receipt_id = v_receipt_id;

    UPDATE public.accounts_payables
    SET receipt_total_amount = v_total,
        remaining_amount = GREATEST(v_total - paid_amount, 0),
        updated_at = NOW()
    WHERE goods_receipt_id = v_receipt_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_receipt_item_sync_payable ON public.goods_receipt_items;
CREATE TRIGGER trg_receipt_item_sync_payable
AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_payable_total_from_receipt_items();

-- ============================================================
-- Backfill: one payable per existing goods receipt that has none.
-- ============================================================
WITH totals AS (
    SELECT goods_receipt_id, SUM(line_total) AS total
    FROM public.goods_receipt_items
    GROUP BY goods_receipt_id
)
INSERT INTO public.accounts_payables (
    tenant_id, goods_receipt_id, supplier_id, invoice_number,
    receipt_total_amount, paid_amount, remaining_amount, due_date, status
)
SELECT
    gr.tenant_id,
    gr.id,
    po.supplier_id,
    gr.invoice_number,
    COALESCE(t.total, 0),
    0,
    COALESCE(t.total, 0),
    gr.received_at::date + s.payment_terms_days,
    'UNPAID'
FROM public.goods_receipts gr
JOIN public.purchase_orders po ON po.id = gr.purchase_order_id
JOIN public.suppliers s ON s.id = po.supplier_id
LEFT JOIN totals t ON t.goods_receipt_id = gr.id
ON CONFLICT (goods_receipt_id) DO NOTHING;
