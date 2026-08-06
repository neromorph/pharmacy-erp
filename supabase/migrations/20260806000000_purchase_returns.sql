-- AP v2: purchase returns act as supplier credit notes.
-- The credit offsets the supplier's global balance; it never mutates
-- the original accounts_payables row.

CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    return_number VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    pbf_credit_note_number VARCHAR(100),
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    applied_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE,
    qty_returned NUMERIC(14,3) NOT NULL,
    unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- Payouts may settle part of an amount with unapplied supplier credit.
ALTER TABLE public.accounts_payable_payments
    ADD COLUMN IF NOT EXISTS credit_applied_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- Policy: tenant isolation (same pattern as accounts_payables).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'purchase_returns'
          AND policyname = 'Tenant isolation for purchase_returns'
    ) THEN
        CREATE POLICY "Tenant isolation for purchase_returns" ON public.purchase_returns
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'purchase_return_items'
          AND policyname = 'Tenant isolation for purchase_return_items'
    ) THEN
        CREATE POLICY "Tenant isolation for purchase_return_items" ON public.purchase_return_items
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant_id ON public.purchase_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON public.purchase_returns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON public.purchase_return_items (purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_batch_id ON public.purchase_return_items (batch_id);
