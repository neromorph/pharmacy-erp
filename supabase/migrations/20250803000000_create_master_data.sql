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
    current_qty INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for product_batches
ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for product_batches" ON public.product_batches
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);