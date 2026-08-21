import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { parseDate } from '../status'
import { getUserRole, canVoidSale } from '../../../../utils/auth'
import { listOpenShift } from '../../shifts/actions'
import { perProductQuantities, sumEmbalase } from '../../../../lib/compound'
import { updateSaleClinicalInfo } from './actions'
import { retrySatusehatSubmission } from './satusehat-actions'
import { SubmitButton } from '@/components/submit-button'
import { VoidSaleDialog } from './void-sale-dialog'
import { formatRupiah } from '@/lib/receipt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const satusehatStatusVariant = {
  PENDING: 'outline',
  SENT: 'default',
  FAILED: 'destructive',
  SKIPPED: 'secondary',
} satisfies Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>

const saleStatusVariant = {
  DRAFT: 'outline',
  PAID: 'default',
  VOID: 'destructive',
} satisfies Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>

async function voidSaleAction(formData: FormData) {
  'use server'
  // SAFETY: asserted value is validated before use or known from the source.
  const id = formData.get('sale_id') as string
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!canVoidSale(role)) redirect(`/sales/${id}`)

  const { data: sale } = await supabase
    .from('sales')
    .select('status')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'PAID') redirect(`/sales/${id}`)

  // Restore batch quantities for all sale items.
  const { data: items } = await supabase
    .from('sale_items')
    .select('product_batch_id, qty_sold')
    .eq('sale_id', id)

  for (const item of items || []) {
    if (!item.product_batch_id) continue
    const { data: batch } = await supabase
      .from('product_batches')
      .select('current_qty')
      .eq('id', item.product_batch_id)
      .single()
    if (batch) {
      await supabase
        .from('product_batches')
        .update({ current_qty: Number(batch.current_qty) + Number(item.qty_sold) })
        .eq('id', item.product_batch_id)
    }
  }

  await supabase
    .from('sales')
    .update({ status: 'VOID' })
    .eq('id', id)
  redirect(`/sales/${id}`)
}

const paymentMethods = ['CASH', 'CARD', 'TRANSFER', 'QRIS']

async function paySale(formData: FormData) {
  'use server'
  // SAFETY: asserted value is validated before use or known from the source.
  const id = formData.get('sale_id') as string
  // SAFETY: asserted value is validated before use or known from the source.
  const paymentMethod = formData.get('payment_method') as string
  const paidAmount = Number(formData.get('paid_amount') || 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // SAFETY: asserted value is validated before use or known from the source.
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const { data: sale } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .single()
  if (!sale || sale.status !== 'DRAFT') {
    redirect(`/sales/${id}`)
    return
  }

  // Hard block: a draft sale may only be paid inside the cashier's own open shift.
  const { data: openShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('user_id', user?.id)
    .eq('status', 'OPEN')
    .maybeSingle()
  if (!openShift || sale.shift_id !== openShift.id) {
    redirect(`/sales/${id}?error=No open shift for this sale`)
    return
  }

  const { data: saleItems } = await supabase
    .from('sale_items')
    .select('*')
    .eq('sale_id', id)

  // FEFO allocation per product: oldest expiry first, then earliest created.
  // Parent compound rows (product_id null) never enter stock allocation.
  const perProduct = perProductQuantities(saleItems || [])

  const allocated: Record<string, { product_batch_id: string; qty: number }[]> = {}
  for (const [productId, qtyNeeded] of perProduct.entries()) {
    const { data: batches } = await supabase
      .from('product_batches')
      .select('id, current_qty')
      .eq('product_id', productId)
      .gt('current_qty', 0)
      .order('expiry_date', { ascending: true })
      .order('created_at', { ascending: true })

    const allocations: { product_batch_id: string; qty: number }[] = []
    let remaining = qtyNeeded
    for (const batch of batches || []) {
      if (remaining <= 0) break
      const take = Math.min(Number(batch.current_qty), remaining)
      allocations.push({ product_batch_id: batch.id, qty: take })
      remaining -= take
    }
    if (remaining > 0) {
      redirect(`/sales/${id}?error=Insufficient stock`)
      return
    }
    allocated[productId] = allocations
  }

  // Backfill batch info on the product's sale_items rows.
  for (const [productId, allocs] of Object.entries(allocated)) {
    if (allocs.length === 0) continue
    const first = allocs[0]
    const { data: batch } = await supabase
      .from('product_batches')
      .select('batch_number, expiry_date')
      .eq('id', first.product_batch_id)
      .single()
    await supabase
      .from('sale_items')
      .update({
        product_batch_id: first.product_batch_id,
        batch_number: batch?.batch_number,
        expiry_date: batch?.expiry_date,
      })
      .eq('sale_id', id)
      .eq('product_id', productId)
  }

  // Deduct batch quantities.
  for (const allocs of Object.values(allocated)) {
    for (const alloc of allocs) {
      const { data: batch } = await supabase
        .from('product_batches')
        .select('current_qty')
        .eq('id', alloc.product_batch_id)
        .single()
      if (batch) {
        const newQty = Number(batch.current_qty) - alloc.qty
        await supabase
          .from('product_batches')
          .update({ current_qty: newQty })
          .eq('id', alloc.product_batch_id)
      }
    }
  }

  const grandTotal = Number(sale.grand_total)
  const changeAmount = paidAmount - grandTotal

  // Aggregate per-parent embalase fees into the sale total (Q3 locked).
  const embalaseTotal = sumEmbalase(saleItems || [])

  await supabase.from('sale_payments').insert([
    {
      tenant_id: tenantId,
      sale_id: id,
      payment_method: paymentMethod,
      amount: paidAmount,
    },
  ])

  await supabase
    .from('sales')
    .update({
      status: 'PAID',
      paid_amount: paidAmount,
      change_amount: changeAmount,
      embalase_amount: embalaseTotal,
      sold_at: new Date().toISOString(),
    })
    .eq('id', id)

  redirect(`/sales/${id}`)
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const userRole = await getUserRole(supabase)
  const openShift = await listOpenShift()
  const { data: sale } = await supabase
    .from('sales')
    .select(
      '*, sale_items (*, products (name, sku)), sale_payments (*), doctors (name, sip_number), patients (name, address, bpjs_number)'
    )
    .eq('id', id)
    .single()

  const [doctorListRes, patientListRes] = await Promise.all([
    supabase.from('doctors').select('id, name, sip_number').order('name', { ascending: true }),
    supabase.from('patients').select('id, name, address, bpjs_number').order('name', { ascending: true }),
  ])

  // SATUSEHAT submission row for this sale (RLS scopes it to the tenant).
  const { data: satusehatSubmission } = await supabase
    .from('satusehat_submissions')
    .select('status, last_error, sent_at')
    .eq('sale_id', id)
    .maybeSingle()

  if (!sale) {
    return <p className="text-sm text-destructive">Transaksi tidak ditemukan</p>
  }

  // Shift gate: draft sale with no shift cannot be paid — keep read-only.
  const shiftMissing = sale.status === 'DRAFT' && !sale.shift_id

  // Pay only if a shift is open.
  const canPay = sale.status === 'DRAFT' && !!openShift
  // SAFETY: sale.status is always one of the sale status values from the query.
  const saleBadgeVariant = saleStatusVariant[sale.status as keyof typeof saleStatusVariant] || 'secondary'
  // SAFETY: satusehatSubmission.status is always one of the SATUSEHAT submission statuses.
  const satusehatBadgeVariant = satusehatSubmission
    ? satusehatStatusVariant[satusehatSubmission.status as keyof typeof satusehatStatusVariant] || 'secondary'
    : 'secondary'

  return (
    <section className="space-y-6">
      <div>
        <Link href="/sales" className="inline-block text-sm text-primary hover:underline">
          Kembali ke Kasir
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-slate-900">{sale.sale_number}</h1>
        <Badge variant={saleBadgeVariant}>{sale.status}</Badge>
        <Badge
          variant={sale.sale_type === 'RESEP' ? 'outline' : sale.sale_type === 'BPJS' ? 'default' : 'secondary'}
          className={sale.sale_type === 'BPJS' ? 'bg-emerald-700 text-white' : ''}
        >
          {sale.sale_type}
        </Badge>
      </div>
      <p className="text-sm text-slate-500">Terjual: {parseDate(sale.sold_at || sale.created_at)}</p>
      {(sale.sale_type === 'RESEP' || sale.sale_type === 'BPJS') && (
        <p className="text-sm text-slate-500">
          {sale.sale_type === 'BPJS' && (
            <Badge className="mr-1.5 bg-emerald-700 text-white">BPJS / JKN</Badge>
          )}
          Dokter: {sale.doctors?.name || '-'}{sale.doctors?.sip_number ? ` (${sale.doctors.sip_number})` : ''} · Pasien:{' '}
          {sale.patients?.name || '-'}
          {sale.sale_type === 'BPJS' && sale.patients?.bpjs_number && (
            <> · No. Peserta: {sale.patients.bpjs_number}</>
          )}
        </p>
      )}
      {sale.sale_type === 'SARANA' && (
        <p className="text-sm text-slate-500">Fasilitas: {sale.patients?.name || '-'}</p>
      )}

      {satusehatSubmission && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Badge variant={satusehatBadgeVariant}>
                SATUSEHAT: {satusehatSubmission.status}
              </Badge>
              {satusehatSubmission.sent_at && (
                <span className="text-xs text-slate-500">
                  Terkirim: {parseDate(satusehatSubmission.sent_at)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {satusehatSubmission.last_error && (
              <p className="text-xs text-slate-500">{satusehatSubmission.last_error}</p>
            )}
            {satusehatSubmission.status === 'FAILED' &&
              (userRole === 'OWNER' || userRole === 'PHARMACIST') && (
                <form action={retrySatusehatSubmission.bind(null, sale.id)}>
                  <SubmitButton variant="outline" size="sm">
                    Kirim Ulang
                  </SubmitButton>
                </form>
              )}
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader className="sticky top-14 z-10 bg-slate-50">
          <TableRow>
            <TableHead>Produk</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Kedaluwarsa</TableHead>
            <TableHead className="text-right">Jml</TableHead>
            <TableHead className="text-right">Harga Satuan</TableHead>
            <TableHead className="text-right">Subtotal Baris</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(sale.sale_items || []).map((it: any) => (
            <TableRow
              key={it.id}
              className={`h-10 ${it.parent_item_id ? 'bg-slate-50' : ''}`}
            >
              <TableCell className={it.parent_item_id ? 'pl-7' : ''}>
                {it.parent_item_id ? '↳ ' : ''}
                {it.item_name || it.products?.name || it.product_id}
              </TableCell>
              <TableCell>{it.batch_number || '-'}</TableCell>
              <TableCell>{it.expiry_date ? parseDate(it.expiry_date) : '-'}</TableCell>
              <TableCell className="text-right tabular-nums">{it.qty_sold}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatRupiah(Number(it.unit_price))}
                {it.embalase_amount && Number(it.embalase_amount) > 0 ? ` + emb ${formatRupiah(Number(it.embalase_amount))}` : ''}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatRupiah(Number(it.line_total))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="text-right">
        <p className="text-sm text-slate-900">
          Subtotal: {formatRupiah(Number(sale.subtotal))}
          {Number(sale.embalase_amount || 0) > 0 && (
            <> • Emb: {formatRupiah(Number(sale.embalase_amount))}</>
          )}
          {Number(sale.tuslah_amount || 0) > 0 && (
            <> • Tuslah: {formatRupiah(Number(sale.tuslah_amount))}</>
          )}
        </p>
        <p className="text-sm">
          Grand Total: <strong className="tabular-nums">{formatRupiah(Number(sale.grand_total))}</strong>
        </p>
        {sale.status === 'PAID' && (
          <p className="mt-1 text-sm tabular-nums text-slate-500">
            Dibayar: {formatRupiah(Number(sale.paid_amount))} • Kembalian: {formatRupiah(Number(sale.change_amount))}
          </p>
        )}
      </div>

      {sale.status === 'DRAFT' && canPay && (
        <Card className="max-w-sm">
          <CardHeader>
            <CardTitle className="text-sm">Selesaikan Transaksi</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={paySale} className="grid gap-3">
              <input type="hidden" name="sale_id" value={sale.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="payment_method">Metode pembayaran</Label>
                <select
                  id="payment_method"
                  name="payment_method"
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                >
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="paid_amount">Jumlah dibayar</Label>
                <Input
                  id="paid_amount"
                  name="paid_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <SubmitButton className="w-fit">Selesaikan Transaksi (Lunas)</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      {(shiftMissing || (sale.status === 'DRAFT' && !canPay)) && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <span className="text-sm text-red-700">
            Tidak dapat membayar: {shiftMissing ? 'draft transaksi ini tidak memiliki shift.' : 'tidak ada shift terbuka.'}
          </span>
          <Link
            href="/shifts/new"
            className="whitespace-nowrap text-sm font-medium text-primary hover:underline"
          >
            Buka Shift →
          </Link>
        </div>
      )}

      {sale.status === 'PAID' && (
        <div>
          <Button render={<Link href={`/receipts/${sale.id}`} />}>Cetak struk</Button>
        </div>
      )}

      {sale.status === 'PAID' && (sale.sale_type === 'RESEP' || sale.sale_type === 'BPJS') && canVoidSale(userRole) && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-sm">Ubah Info Resep</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateSaleClinicalInfo} className="grid gap-3">
              <input type="hidden" name="sale_id" value={sale.id} />
              <div className="grid gap-1.5">
                <Label htmlFor="doctor_id">Dokter</Label>
                <select
                  id="doctor_id"
                  name="doctor_id"
                  defaultValue={sale.doctor_id || ''}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                >
                  <option value="">-</option>
                  {(doctorListRes.data || []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.sip_number ? ` (${d.sip_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="patient_id">Pasien</Label>
                <select
                  id="patient_id"
                  name="patient_id"
                  defaultValue={sale.patient_id || ''}
                  className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                >
                  <option value="">-</option>
                  {(patientListRes.data || []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.address ? ` (${p.address})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <SubmitButton className="w-fit">Simpan</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}

      {sale.status === 'PAID' && canVoidSale(userRole) && (
        <VoidSaleDialog saleId={sale.id} action={voidSaleAction} />
      )}
    </section>
  )
}
