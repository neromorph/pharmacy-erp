-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants Table (one row per pharmacy branch)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products Table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR NOT NULL,
    sku VARCHAR NOT NULL,
    base_unit VARCHAR NOT NULL,
    min_stock_level INT NOT NULL DEFAULT 0,
    category VARCHAR NOT NULL,
    is_expired_sensitive BOOLEAN NOT NULL DEFAULT true,
    rack_location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for products" ON public.products
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Product Units Table (Selling units)
CREATE TABLE public.product_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    unit_name VARCHAR NOT NULL,
    multiplier INT NOT NULL DEFAULT 1,
    barcode VARCHAR,
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for product_units (Inherits implicitly if queried through product, but we secure it anyway)
ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for product_units" ON public.product_units
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_units.product_id
            AND p.tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid
        )
    );

-- Product Batches Table (Stock holding)
CREATE TABLE public.product_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number VARCHAR NOT NULL,
    expiry_date DATE,
    current_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for product_batches
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for product_batches" ON public.product_batches
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Suppliers Table (PBF in UI)
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_pbf BOOLEAN NOT NULL DEFAULT TRUE,
    pbf_license_number VARCHAR(100),
    phone VARCHAR(50),
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for suppliers" ON public.suppliers
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Purchase Order Status Enum
CREATE TYPE public.purchase_order_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'RECEIVED',
    'CANCELLED'
);

-- Purchase Orders Table
CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    po_number VARCHAR(50) NOT NULL,
    status public.purchase_order_status NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    ordered_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_by UUID,
    approved_by UUID,
    received_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, po_number)
);

-- RLS for purchase_orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for purchase_orders" ON public.purchase_orders
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Purchase Order Items Table
CREATE TABLE public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    qty_ordered NUMERIC(14,3) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for purchase_order_items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for purchase_order_items" ON public.purchase_order_items
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Goods Receipts Table
CREATE TABLE public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, receipt_number)
);

-- RLS for goods_receipts
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for goods_receipts" ON public.goods_receipts
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Goods Receipt Items Table
CREATE TABLE public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    qty_received NUMERIC(14,3) NOT NULL,
    unit_cost NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for goods_receipt_items
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for goods_receipt_items" ON public.goods_receipt_items
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
-- Sale Status Enum
CREATE TYPE public.sale_status AS ENUM (
    'DRAFT',
    'PAID',
    'VOID'
);

-- Sales Table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    sale_number VARCHAR(50) NOT NULL,
    status public.sale_status NOT NULL DEFAULT 'DRAFT',
    subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
    discount_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    grand_total NUMERIC(18,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    change_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    cashier_id UUID,
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, sale_number)
);

-- RLS for sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for sales" ON public.sales
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Sale Items Table
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_batch_id UUID REFERENCES public.product_batches(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100),
    expiry_date DATE,
    qty_sold NUMERIC(14,3) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for sale_items" ON public.sale_items
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Sale Payments Table
CREATE TABLE public.sale_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reference_number VARCHAR(100),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for sale_payments
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for sale_payments" ON public.sale_payments
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- AP v1 needs one payable header row per goods receipt.
-- AP v1 needs one payout row per partial or full payment.

-- Accounts Payable Status Enum
CREATE TYPE public.accounts_payable_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

-- Accounts Payables Table (one row per goods receipt)
CREATE TABLE public.accounts_payables (
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

-- Accounts Payable Payments Table (one row per payout)
CREATE TABLE public.accounts_payable_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    accounts_payable_id UUID NOT NULL REFERENCES public.accounts_payables(id) ON DELETE CASCADE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount NUMERIC(18,2) NOT NULL,
    method TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for accounts_payables
ALTER TABLE public.accounts_payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounts_payables" ON public.accounts_payables
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- RLS for accounts_payable_payments
ALTER TABLE public.accounts_payable_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for accounts_payable_payments" ON public.accounts_payable_payments
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Indexes for accounts_payables
CREATE INDEX idx_accounts_payables_tenant_id ON public.accounts_payables (tenant_id);
CREATE INDEX idx_accounts_payables_supplier_id ON public.accounts_payables (supplier_id);
CREATE INDEX idx_accounts_payables_due_date ON public.accounts_payables (due_date);
CREATE INDEX idx_accounts_payables_status ON public.accounts_payables (status);
CREATE INDEX idx_accounts_payable_payments_payable_id ON public.accounts_payable_payments (accounts_payable_id);

-- due_date = goods_receipts.received_at::date + suppliers.payment_terms_days
-- remaining_amount = receipt_total_amount - SUM(payments.amount)

-- ============================================================
-- AP v1 follow-up: auto-create accounts_payables from receipts
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

CREATE TRIGGER trg_receipt_item_sync_payable
AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipt_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_payable_total_from_receipt_items();

-- Backfill: one payable per existing goods receipt that has none.
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
