-- 20260804000005: prescription master data + sales clinical refactor
-- Resep Dokter & Obat Racikan effort (ticket 03).

-- Sale type: OTC (walk-in, no prescription) or RESEP (dispensed from a prescriber).
CREATE TYPE public.sale_type AS ENUM ('OTC', 'RESEP');

-- Prescribers. One tenant = one branch; doctors recur across prescriptions.
CREATE TABLE public.doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sip_number TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for doctors" ON public.doctors
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Patients. Address is the legal field for narcotic/psychotropic records.
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    birth_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for patients" ON public.patients
    FOR ALL
    USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Sales: prescription identity + service fees. FKs use SET NULL so removing a
-- doctor or patient never erases a receipt's trace (audit-safe).
ALTER TABLE public.sales
    ADD COLUMN sale_type public.sale_type NOT NULL DEFAULT 'OTC',
    ADD COLUMN doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    ADD COLUMN patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    ADD COLUMN tuslah_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN embalase_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Receipt/audit lookups by prescriber or patient.
CREATE INDEX idx_sales_doctor_id ON public.sales (doctor_id);
CREATE INDEX idx_sales_patient_id ON public.sales (patient_id);
