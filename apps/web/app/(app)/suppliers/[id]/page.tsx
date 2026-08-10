import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { buildStatementLedger, computeSupplierBalance } from '../../../../lib/purchase-returns'
import { PrintButton } from './print-button'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// A4 print CSS scoped to .statement-print.
function printCss(): string {
  return `
  @media print {
    @page { size: A4; margin: 14mm; }
    body * { visibility: hidden; }
    .statement-print, .statement-print * { visibility: visible; }
    .statement-print { position: absolute; top: 0; left: 0; width: 100%; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 4px 8px; font-size: 12px; }
  }
`
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function SupplierStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!role || role === 'CASHIER') {
    return <p className="text-sm text-destructive">Akses ditolak. Hanya Owner, Apoteker, atau staf Inventori.</p>
  }

  const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', id).single()
  if (!supplier) return <p className="text-sm text-slate-500">Pemasok tidak ditemukan</p>

  const { data: payables } = await supabase
    .from('accounts_payables')
    .select('id, invoice_number, due_date, receipt_total_amount, paid_amount, remaining_amount, goods_receipts(received_at, purchase_order_id)')
    .eq('supplier_id', id)

  const payableIds = (payables || []).map((p: any) => p.id)
  const { data: payments } =
    payableIds.length > 0
      ? await supabase
          .from('accounts_payable_payments')
          .select('id, paid_at, amount, method, notes, credit_applied_amount, accounts_payable_id')
          .in('accounts_payable_id', payableIds)
          .order('paid_at', { ascending: true })
      : { data: [] }

  const { data: returns } = await supabase
    .from('purchase_returns')
    .select('id, return_number, returned_at, reason, total_amount')
    .eq('supplier_id', id)
    .order('returned_at', { ascending: true })

  // Map invoice number to its purchase order id for the drill-down links.
  // The typegen types the to-one embed as an array; cast to any.
  const poByInvoice = new Map<string, string>()
  for (const p of (payables || []) as any[]) {
    poByInvoice.set(p.invoice_number, p.goods_receipts?.purchase_order_id)
  }

  const ledger = buildStatementLedger({
    invoices: (payables || []).map((p: any) => ({
      date: p.goods_receipts?.received_at || p.due_date,
      ref: p.invoice_number,
      description: 'Faktur',
      amount: Number(p.receipt_total_amount),
    })),
    payments: (payments || []).map((pm: any) => ({
      date: pm.paid_at,
      ref: pm.method,
      description: pm.notes || 'Pembayaran',
      amount: Number(pm.amount),
      creditApplied: Number(pm.credit_applied_amount || 0),
    })),
    returns: (returns || []).map((r: any) => ({
      date: r.returned_at,
      ref: r.return_number,
      description: r.reason,
      amount: Number(r.total_amount),
    })),
  })

  const closingBalance = ledger.length > 0 ? ledger[ledger.length - 1].balance : 0
  const balance = computeSupplierBalance(
    (payables || []).map((p: any) => ({ remaining: Number(p.remaining_amount) })),
    (returns || []).map((r: any) => ({ total: Number(r.total_amount), applied: 0 }))
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: printCss() }} />
      <section className="space-y-6">
        <div className="no-print flex items-center justify-between">
          <Link href="/suppliers" className="text-sm text-primary hover:underline">
            Kembali ke Pemasok
          </Link>
          <PrintButton />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{supplier.name}</h1>

        <div className="grid max-w-2xl grid-cols-1 gap-x-4 gap-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10 sm:grid-cols-2">
          <div>
            PBF: <strong>{supplier.is_pbf ? 'Ya' : 'Tidak'}</strong>
          </div>
          <div>
            Izin: <strong>{supplier.pbf_license_number || '-'}</strong>
          </div>
          <div>
            Telepon: <strong>{supplier.phone || '-'}</strong>
          </div>
          <div>
            Termin Pembayaran: <strong>{supplier.payment_terms_days} hari</strong>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Statement (Kartu Hutang)</h2>
          <div className="statement-print overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <div className="px-4 pt-3 text-xs text-slate-500">
              Supplier: {supplier.name} • Dicetak: {new Date().toLocaleDateString()}
            </div>
            {ledger.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Belum ada transaksi</p>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Referensi</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Kredit</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((row, i) => {
                    const poId = poByInvoice.get(row.ref)
                    return (
                      <TableRow key={i} className="h-10">
                        <TableCell>{parseDate(row.date)}</TableCell>
                        <TableCell>
                          {poId ? (
                            <Link href={`/procurement/${poId}`} className="text-primary hover:underline">
                              {row.ref}
                            </Link>
                          ) : (
                            row.ref
                          )}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.debit > 0 ? row.debit.toFixed(2) : ''}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.credit > 0 ? row.credit.toFixed(2) : ''}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5}>Saldo Akhir</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {closingBalance.toFixed(2)}
                      {balance < 0 && (
                        <span className="text-xs text-slate-500"> (saldo kredit)</span>
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
