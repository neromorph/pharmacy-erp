-- Stock Opname Status Enum
CREATE TYPE public.opname_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');
CREATE TYPE public.opname_type AS ENUM ('FULL_STORE', 'RACK_BASED', 'AD_HOC_SINGLE');
CREATE TYPE public.opname_reason AS ENUM ('DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC');

-- Stock Opname Sessions Table
-- One row is one physical count session.
CREATE TABLE public.stock_opnames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    opname_number VARCHAR(50) NOT NULL,
    type public.opname_type NOT NULL,
    status public.opname_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, opname_number)
);

-- RLS for stock_opnames
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stock_opnames" ON public.stock_opnames
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Stock Opname Items Table
-- One row is one batch counted in one session.
CREATE TABLE public.stock_opname_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    opname_id UUID NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
    system_qty_base NUMERIC(14,3) NOT NULL,
    physical_qty_base NUMERIC(14,3) NOT NULL,
    variance_qty_base NUMERIC(14,3) NOT NULL,
    reason public.opname_reason NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for stock_opname_items
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stock_opname_items" ON public.stock_opname_items
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Dashboard KPI Function
-- Returns the three dashboard numbers in one JSON payload.
-- The function is SECURITY INVOKER. It uses the caller RLS policies for tenant isolation.
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis()
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT json_build_object(
        'daily_sales', (
            SELECT COALESCE(SUM(
                CASE
                    WHEN s.status = 'PAID' THEN s.grand_total
                    WHEN s.status = 'VOID' THEN -s.grand_total
                    ELSE 0
                END
            ), 0)
            FROM public.sales s
            WHERE (s.sold_at AT TIME ZONE 'Asia/Jakarta')::date
                = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta')::date
        ),
        'low_stock_count', (
            SELECT COUNT(*)
            FROM public.products p
            WHERE COALESCE((
                SELECT SUM(b.current_qty)
                FROM public.product_batches b
                WHERE b.product_id = p.id
            ), 0) <= p.min_stock_level
        ),
        'near_expiry_count', (
            SELECT COUNT(DISTINCT p.id)
            FROM public.products p
            WHERE EXISTS (
                SELECT 1
                FROM public.product_batches b
                WHERE b.product_id = p.id
                AND b.expiry_date <= CURRENT_DATE
                    + (CASE WHEN p.is_expired_sensitive THEN 30 ELSE 60 END)
            )
        )
    );
$$;
