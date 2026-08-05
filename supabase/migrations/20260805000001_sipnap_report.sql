-- 20260805000001: SIPNAP v1 monthly report RPC.
-- Returns one JSON payload: transactions, missing-data rows, and per-product
-- stock totals for Narkotika and Psikotropika in one month.
-- The function is SECURITY INVOKER. It uses the caller RLS policies for tenant isolation.

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
        tx_valid AS (
            SELECT *,
                (doctor_name IS NOT NULL AND doctor_sip IS NOT NULL
                 AND patient_name IS NOT NULL AND patient_address IS NOT NULL) AS ready
            FROM tx
        ),
        missing AS (
            SELECT sale_id, sale_number,
                array_remove(ARRAY[
                    CASE WHEN doctor_name IS NULL THEN 'Doctor Name' END,
                    CASE WHEN doctor_sip IS NULL THEN 'Doctor SIP' END,
                    CASE WHEN patient_name IS NULL THEN 'Patient Name' END,
                    CASE WHEN patient_address IS NULL THEN 'Patient Address' END
                ], NULL) AS missing_fields
            FROM tx_valid
            WHERE NOT ready
            GROUP BY sale_id, sale_number, doctor_name, doctor_sip, patient_name, patient_address
        ),
        movements AS (
            SELECT pr.id AS product_id, pr.name AS product_name,
                COALESCE(SUM(gri.qty_received), 0) AS pemasukan
            FROM public.products pr
            LEFT JOIN public.goods_receipt_items gri ON gri.product_id = pr.id
            LEFT JOIN public.goods_receipts gr ON gr.id = gri.goods_receipt_id
                AND gr.received_at >= v_start AND gr.received_at < v_end
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
            GROUP BY pr.id, pr.name
        ),
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
                ), 0) AS saldo_awal
            FROM public.products pr
            WHERE pr.tenant_id = v_tenant_id
              AND pr.regulatory_category IN ('NARKOTIKA', 'PSIKOTROPIKA')
        )
        SELECT json_build_object(
            'month', p_month,
            'year', p_year,
            'ready', NOT EXISTS (SELECT 1 FROM missing),
            'transactions', COALESCE((
                SELECT json_agg(json_build_object(
                    'sale_id', sale_id, 'sale_number', sale_number, 'sold_at', sold_at,
                    'doctor_name', doctor_name, 'doctor_sip', doctor_sip,
                    'patient_name', patient_name, 'patient_address', patient_address,
                    'product_name', product_name, 'qty_sold', qty_sold
                )) FROM tx_valid), '[]'::json),
            'missing', COALESCE((
                SELECT json_agg(json_build_object(
                    'sale_id', sale_id, 'sale_number', sale_number,
                    'missing_fields', missing_fields
                )) FROM missing), '[]'::json),
            'products', COALESCE((
                SELECT json_agg(json_build_object(
                    'product_name', m.product_name,
                    'saldo_awal', o.saldo_awal,
                    'pemasukan', m.pemasukan,
                    'pengeluaran', COALESCE((
                        SELECT SUM(tx2.qty_sold) FROM tx_valid tx2
                        WHERE tx2.product_name = m.product_name
                    ), 0),
                    'status_pemusnahan', 'TIDAK ADA',
                    'saldo_akhir', o.saldo_awal + m.pemasukan - COALESCE((
                        SELECT SUM(tx2.qty_sold) FROM tx_valid tx2
                        WHERE tx2.product_name = m.product_name
                    ), 0)
                ))
                FROM movements m
                JOIN opening o ON o.product_id = m.product_id
            ), '[]'::json)
        )
    );
END;
$$;
