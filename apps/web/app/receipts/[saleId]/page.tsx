import { createClient } from '../../../utils/supabase/server'
import { formatReceiptTender, formatRupiah } from '../../../lib/receipt'
import { PrintButton } from './print-button'

// Thermal CSS injected only under @media print, scoped to .receipt-print.
// Width: 80mm default, 58mm via ?w=58.
function receiptCss(width: string): string {
  const mm = width === '58' ? '58mm' : '80mm'
  return `
  @media print {
    body * { visibility: hidden; }
    .receipt-print, .receipt-print * { visibility: visible; }
    .receipt-print { position: fixed; top: 0; left: 0; width: ${mm}; }
    .no-print { display: none !important; }
  }
`
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>
  searchParams: Promise<{ w?: string }>
}) {
  const { saleId } = await params
  const { w } = await searchParams
  const width = w === '58' ? '58' : '80'
  const supabase = await createClient()

  const { data: sale } = await supabase
    .from('sales')
    .select(
      '*, sale_items(*, products(name, sku)), sale_payments(*)'
    )
    .eq('id', saleId)
    .single()

  if (!sale) {
    return <p>Sale not found</p>
  }

  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  const { data: tenant } = tenantId
    ? await supabase.from('tenants').select('id, name, address, phone, sia_number, sipa_number, logo_url, receipt_footer').eq('id', tenantId).single()
    : { data: null }

  // Cashier display name comes from the sale's shift (auth.users is not
  // queryable via PostgREST).
  let cashierName: string | null = null
  if (sale.shift_id) {
    const { data: shift } = await supabase
      .from('shifts')
      .select('cashier_name')
      .eq('id', sale.shift_id)
      .maybeSingle()
    cashierName = shift?.cashier_name ?? null
  }

  const items = sale.sale_items || []
  const payments = sale.sale_payments || []
  const tender = formatReceiptTender(payments, Number(sale.grand_total))

  return (
    <>
      {/* Print CSS scoped to .receipt-print */}
      <style dangerouslySetInnerHTML={{ __html: receiptCss(width) }} />

      {/* Screen preview — hidden when printing */}
      <section style={{ maxWidth: 480, margin: '24px auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }} className="no-print">
          <h1 style={{ fontSize: 18, margin: 0 }}>Struk Pembayaran</h1>
          <PrintButton />
        </div>
        <div style={{ marginBottom: 8 }} className="no-print">
          <a
            href={`/receipts/${saleId}${width === '58' ? '?w=80' : '?w=58'}`}
            style={{ color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none' }}
          >
            {width === '58' ? 'Switch to 80mm' : 'Switch to 58mm'}
          </a>
        </div>

        <div
          className="receipt-print"
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '16px 12px',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.6,
            color: '#111',
          }}
        >
          {/* Store header */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            {tenant?.logo_url && (
              <img
                src={tenant.logo_url}
                alt="Store logo"
                style={{ width: 48, height: 48, objectFit: 'contain', marginBottom: 4 }}
              />
            )}
            <strong style={{ fontSize: 14, display: 'block' }}>
              {tenant?.name ?? 'TOKO FARMASI'}
            </strong>
            {tenant?.address && (
              <span style={{ fontSize: 10 }}>{tenant.address}</span>
            )}
            {tenant?.phone && (
              <span style={{ fontSize: 10, display: 'block' }}>{tenant.phone}</span>
            )}
            {tenant?.sia_number && (
              <span style={{ fontSize: 10 }}>SIA: {tenant.sia_number}</span>
            )}
            {tenant?.sipa_number && (
              <span style={{ fontSize: 10, display: 'block' }}>SIPA: {tenant.sipa_number}</span>
            )}
          </div>

          <div style={{ textAlign: 'center', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', marginBottom: 8 }}>
            Struk Kasir
          </div>

          {/* Invoice info */}
          <div style={{ fontSize: 11 }}>
            {/* TODO: add sia_number, sipa_number when tenants table has those columns */}
            <div>No: {sale.sale_number}</div>
            <div>Tanggal: {parseDate(sale.sold_at || sale.created_at)}</div>
            {cashierName && <div>Kasir: {cashierName}</div>}
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '8px 0' }} />

          {/* Line items */}
          <div style={{ fontSize: 11 }}>
            {items.map((it: any) => (
              <div key={it.id} style={{ marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>
                  {it.products?.name ?? it.product_id}
                </div>
                <div style={{ color: '#555', fontSize: 10 }}>
                  {it.qty_sold} x {formatRupiah(Number(it.unit_price))}
                  {it.batch_number ? ` | Batch: ${it.batch_number}` : ''}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(Number(it.line_total))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed #000', padding: '4px 0', marginTop: 8 }} />

          {/* Totals */}
          <div style={{ fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal</span>
              <span>{formatRupiah(Number(sale.subtotal || 0))}</span>
            </div>
            {Number(sale.discount_total || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Diskon</span>
                <span>-{formatRupiah(Number(sale.discount_total))}</span>
              </div>
            )}
            {Number(sale.tax_total || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pajak</span>
                <span>{formatRupiah(Number(sale.tax_total))}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                fontSize: 13,
                borderTop: '1px solid #000',
                paddingTop: 4,
                marginTop: 4,
              }}
            >
              <span>TOTAL</span>
              <span>{formatRupiah(Number(sale.grand_total))}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #000', padding: '4px 0', margin: '8px 0' }} />

          {/* Payment */}
          <div style={{ fontSize: 11 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pembayaran</span>
              <span>{tender.label}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Bayar</span>
              <span>{formatRupiah(tender.amount)}</span>
            </div>
            {tender.change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Kembalian</span>
                <span>{formatRupiah(tender.change)}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #000', padding: '4px 0', margin: '8px 0' }} />

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: 10 }}>
            Terima kasih atas kunjungan Anda
          </div>
          {tenant?.receipt_footer && (
            <div style={{ textAlign: 'center', fontSize: 9, marginTop: 4, color: '#666' }}>
              {tenant.receipt_footer}
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }} className="no-print">
          <a
            href={`/sales/${saleId}`}
            style={{ color: 'var(--primary)', fontSize: 13, textDecoration: 'none' }}
          >
            ← Kembali ke detail penjualan
          </a>
        </div>
      </section>
    </>
  )
}