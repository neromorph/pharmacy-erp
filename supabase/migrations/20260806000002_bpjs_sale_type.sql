-- 20260806000002: BPJS sale type (SE 031/XI/2014 zero-fee rule).
-- Adds BPJS to sale_type enum, patients.bpjs_number, and a DB CHECK
-- that enforces zero tuslah/embalase on BPJS sales. Updates the
-- SIPNAP RPC to group BPJS with RESEP in Pengeluaran Untuk Resep.

-- ============================================================
-- 1. Add BPJS to sale_type enum (idempotent guard).
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'sale_type' AND e.enumlabel = 'BPJS'
    ) THEN
        ALTER TYPE public.sale_type ADD VALUE 'BPJS' AFTER 'RESEP';
    END IF;
END$$;

-- ============================================================
-- 2. BPJS membership number on patients (nullable — only BPJS
--    patients have one; reusable across visits).
-- ============================================================
ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS bpjs_number TEXT;

-- ============================================================
-- 3. DB guardian for SE 031/XI/2014: BPJS sales must have zero fees.
--    UI locks the inputs; this constraint catches any API bypass.
-- ============================================================
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS check_bpjs_zero_fees;
ALTER TABLE public.sales
    ADD CONSTRAINT check_bpjs_zero_fees
    CHECK (sale_type <> 'BPJS' OR (tuslah_amount = 0 AND embalase_amount = 0));

-- ============================================================
-- 4. Update get_sipnap_report: group BPJS with RESEP in
--    Pengeluaran Untuk Resep.  Drop and recreate; Change A is the
--    only functional change (sales_out CTE).  Change B (validation
--    CTE) requires no change — sale_type <> 'SARANA' already covers
--    BPJS since both need doctor name, doctor SIP, patient name,
--    and patient address.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_sipnap_report(integer, integer);

CREATE OR REPLACE FUNCTION public.get_sipnap_report(p_month INT, p_year INT)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
    v_tenant_id UUID;
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    v_tenant_id := (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid;
    v_start := make_timestamptz(p_year, p_month, 1, 0, 0, 0, 'Asia/Jakarta');
    v_end := v_start + INTERVAL '1 month';

    RETURN (
        WITH tx AS (
            SELECT
                s.id AS sale_id,
                s.sale_number,
                s.sold_at,
                s.sale_type,
                d.name AS doctor_name,
                d.sip_number AS doctor_sip,
                p.name AS patient_name,
                p.address AS patient_address,
                pr.name AS product_name,
                pr.regulatory_category,
                si.qty_sold
            FROM public.sales s
            JOIN public.sale_items si ON si.sale_id = s.id
            JOIN public.products pr ON pr.id = si.product_id
            LEFT JOIN public.doctors d ON d.id = s.doctor_id
            LEFT JOIN public.patients p ON p.id = s.patient_id
            WHERE s.tenant_id = v_tenant_id
              AND s.status = 'PAID'
              AND s.sold_at >= v_start AND s.sold_at < v_end
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
        ),
        -- SARANA rows need only a facility name; RESEP and BPJS rows need
        -- the full set (doctor name + SIP, patient name + address).
        tx_valid AS (
            SELECT *,
                CASE
                    WHEN sale_type = 'SARANA' THEN patient_name IS NOT NULL
                    ELSE (doctor_name IS NOT NULL AND doctor_sip IS NOT NULL
                          AND patient_name IS NOT NULL AND patient_address IS NOT NULL)
                END AS ready
            FROM tx
        ),
        missing AS (
            SELECT sale_id, sale_number,
                array_remove(ARRAY[
                    CASE WHEN sale_type <> 'SARANA' AND doctor_name IS NULL THEN 'Doctor Name' END,
                    CASE WHEN sale_type <> 'SARANA' AND doctor_sip IS NULL THEN 'Doctor SIP' END,
                    CASE WHEN patient_name IS NULL THEN 'Patient Name' END,
                    CASE WHEN sale_type <> 'SARANA' AND patient_address IS NULL THEN 'Patient Address' END
                ], NULL) AS missing_fields
            FROM tx_valid
            WHERE NOT ready
            GROUP BY sale_id, sale_number, sale_type, doctor_name, doctor_sip, patient_name, patient_address
        ),
        -- Incoming by source: PBF vs other facilities.
        movements AS (
            SELECT pr.id AS product_id, pr.name AS product_name,
                COALESCE(SUM(CASE WHEN sup.is_pbf THEN gri.qty_received ELSE 0 END), 0) AS pemasukan_pbf,
                COALESCE(SUM(CASE WHEN NOT sup.is_pbf THEN gri.qty_received ELSE 0 END), 0) AS pemasukan_sarana
            FROM public.products pr
            LEFT JOIN public.goods_receipt_items gri ON gri.product_id = pr.id
            LEFT JOIN public.goods_receipts gr ON gr.id = gri.goods_receipt_id
                AND gr.received_at >= v_start AND gr.received_at < v_end
            LEFT JOIN public.purchase_orders po ON po.id = gr.purchase_order_id
            LEFT JOIN public.suppliers sup ON sup.id = po.supplier_id
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
            GROUP BY pr.id, pr.name
        ),
        -- Outgoing by type: prescription (RESEP + BPJS) vs facility transfer (SARANA).
        -- CHANGE A: group BPJS with RESEP under pengeluaran_resep.
        sales_out AS (
            SELECT pr.id AS product_id, pr.name AS product_name,
                COALESCE(SUM(CASE WHEN s.sale_type IN ('RESEP', 'BPJS') THEN si.qty_sold ELSE 0 END), 0) AS pengeluaran_resep,
                COALESCE(SUM(CASE WHEN s.sale_type = 'SARANA' THEN si.qty_sold ELSE 0 END), 0) AS pengeluaran_sarana
            FROM public.products pr
            LEFT JOIN public.sale_items si ON si.product_id = pr.id
            LEFT JOIN public.sales s ON s.id = si.sale_id
                AND s.status = 'PAID' AND s.sold_at >= v_start AND s.sold_at < v_end
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
            GROUP BY pr.id, pr.name
        ),
        -- Destroyed qty in the month, with the BAP reference.
        destroyed AS (
            SELECT pr.id AS product_id, pr.name AS product_name,
                COALESCE(SUM(d.qty_destroyed), 0) AS jumlah_dimusnahkan,
                (ARRAY_AGG(d.bap_number ORDER BY d.bap_date))[1] AS bap_number,
                (ARRAY_AGG(d.bap_date ORDER BY d.bap_date))[1] AS bap_date
            FROM public.products pr
            LEFT JOIN (
                SELECT sdi.product_id, sdi.qty_destroyed, sd.bap_number, sd.bap_date
                FROM public.stock_destruction_items sdi
                JOIN public.stock_destructions sd ON sd.id = sdi.stock_destruction_id
                WHERE sd.bap_date >= v_start::date AND sd.bap_date < v_end::date
            ) d ON d.product_id = pr.id
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
            GROUP BY pr.id, pr.name
        ),
        -- Opening stock: all movements before the month.
        opening AS (
            SELECT pr.id AS product_id,
                COALESCE((
                    SELECT SUM(gri.qty_received)
                    FROM public.goods_receipt_items gri
                    JOIN public.goods_receipts gr ON gr.id = gri.goods_receipt_id
                    WHERE gri.product_id = pr.id AND gr.tenant_id = v_tenant_id
                      AND gr.received_at < v_start
                ), 0)
                - COALESCE((
                    SELECT SUM(si.qty_sold)
                    FROM public.sale_items si
                    JOIN public.sales s ON s.id = si.sale_id
                    WHERE si.product_id = pr.id AND s.tenant_id = v_tenant_id
                      AND s.status = 'PAID' AND s.sold_at < v_start
                ), 0)
                - COALESCE((
                    SELECT SUM(sdi.qty_destroyed)
                    FROM public.stock_destruction_items sdi
                    JOIN public.stock_destructions sd ON sd.id = sdi.stock_destruction_id
                    WHERE sdi.product_id = pr.id AND sd.tenant_id = v_tenant_id
                      AND sd.bap_date < v_start::date
                ), 0) AS saldo_awal
            FROM public.products pr
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
        ),
        per_product AS (
            SELECT m.product_id, m.product_name,
                o.saldo_awal,
                m.pemasukan_pbf, m.pemasukan_sarana,
                so.pengeluaran_resep, so.pengeluaran_sarana,
                d.jumlah_dimusnahkan, d.bap_number, d.bap_date,
                o.saldo_awal + m.pemasukan_pbf + m.pemasukan_sarana
                    - so.pengeluaran_resep - so.pengeluaran_sarana
                    - d.jumlah_dimusnahkan AS saldo_akhir
            FROM movements m
            JOIN opening o ON o.product_id = m.product_id
            JOIN sales_out so ON so.product_id = m.product_id
            JOIN destroyed d ON d.product_id = m.product_id
        ),
        -- Hard-block rows.
        negative_rows AS (
            SELECT product_name FROM per_product WHERE saldo_akhir < 0
        ),
        bap_rows AS (
            SELECT 1 AS found
            FROM public.stock_destruction_items sdi
            JOIN public.stock_destructions sd ON sd.id = sdi.stock_destruction_id
            WHERE sd.tenant_id = v_tenant_id
              AND sd.bap_date >= v_start::date AND sd.bap_date < v_end::date
              AND (sd.bap_number IS NULL OR sd.bap_number = '')
            LIMIT 1
        ),
        -- Continuity: current Stok Awal must equal the previous month's
        -- stored Stok Akhir snapshot. No prior export = no check.
        prev_export AS (
            SELECT payload FROM public.sipnap_exports
            WHERE tenant_id = v_tenant_id
              AND report_month = CASE WHEN p_month = 1 THEN 12 ELSE p_month - 1 END
              AND report_year = CASE WHEN p_month = 1 THEN p_year - 1 ELSE p_year END
            ORDER BY generated_at DESC
            LIMIT 1
        ),
        continuity_rows AS (
            SELECT pp.product_name, (snap->>'saldo_akhir')::numeric AS expected, pp.saldo_awal AS actual
            FROM per_product pp
            JOIN prev_export pe ON true
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pe.payload->'products', '[]'::jsonb)) AS snap
            WHERE snap->>'product_id' = pp.product_id::text
              AND (snap->>'saldo_akhir')::numeric <> pp.saldo_awal
        )
        SELECT json_build_object(
            'month', p_month,
            'year', p_year,
            'ready',
                NOT EXISTS (SELECT 1 FROM missing)
                AND NOT EXISTS (SELECT 1 FROM negative_rows)
                AND NOT EXISTS (SELECT 1 FROM bap_rows)
                AND NOT EXISTS (SELECT 1 FROM continuity_rows),
            'transactions', COALESCE((
                SELECT json_agg(json_build_object(
                    'sale_id', sale_id, 'sale_number', sale_number, 'sold_at', sold_at,
                    'sale_type', sale_type,
                    'doctor_name', doctor_name, 'doctor_sip', doctor_sip,
                    'patient_name', patient_name, 'patient_address', patient_address,
                    'product_name', product_name, 'qty_sold', qty_sold
                )) FROM tx_valid), '[]'::json),
            'missing', COALESCE((
                SELECT json_agg(json_build_object(
                    'sale_id', sale_id, 'sale_number', sale_number,
                    'missing_fields', missing_fields
                )) FROM missing), '[]'::json),
            'checks', COALESCE((
                SELECT json_agg(chk) FROM (
                    SELECT json_build_object('type', 'NEGATIVE', 'product_name', product_name) AS chk FROM negative_rows
                    UNION ALL
                    SELECT json_build_object('type', 'BAP') FROM bap_rows
                    UNION ALL
                    SELECT json_build_object('type', 'CONTINUITY', 'product_name', product_name,
                        'expected', expected, 'actual', actual) FROM continuity_rows
                ) all_checks
            ), '[]'::json),
            'products', COALESCE((
                SELECT json_agg(json_build_object(
                    'product_id', product_id, 'product_name', product_name,
                    'saldo_awal', saldo_awal,
                    'pemasukan_dari_pbf', pemasukan_pbf,
                    'pemasukan_dari_sarana', pemasukan_sarana,
                    'pengeluaran_untuk_resep', pengeluaran_resep,
                    'pengeluaran_untuk_sarana', pengeluaran_sarana,
                    'jumlah_dimusnahkan', jumlah_dimusnahkan,
                    'status_pemusnahan', CASE WHEN jumlah_dimusnahkan > 0 THEN 'ADA' ELSE 'TIDAK ADA' END,
                    'bap_number', bap_number,
                    'bap_date', bap_date,
                    'saldo_akhir', saldo_akhir
                )) FROM per_product), '[]'::json)
        )
    );
END;
$$;