-- Shift management tables and sale attribution.

-- Shift status enum: OPEN, CLOSED, FORCE_CLOSED.
CREATE TYPE public.shift_status AS ENUM ('OPEN', 'CLOSED', 'FORCE_CLOSED');

-- One shift per cashier per tenant. Opening cash is required.
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status public.shift_status NOT NULL DEFAULT 'OPEN',
    opening_cash NUMERIC(14,3) NOT NULL DEFAULT 0,
    closing_cash NUMERIC(14,3),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    notes TEXT
);

-- RLS: tenant isolation via JWT claims.
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for shifts" ON public.shifts
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Attribute sales to the shift that produced them.
ALTER TABLE public.sales
    ADD COLUMN shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL;

-- Index for the draft-block-on-close check and shift sale listing.
CREATE INDEX idx_shifts_user_open ON public.shifts (user_id, status);
CREATE INDEX idx_sales_shift_id ON public.sales (shift_id);