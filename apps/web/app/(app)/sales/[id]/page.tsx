import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { parseDate } from '../status'
import { getUserRole, canVoidSale } from '../../../../utils/auth'
import { listOpenShift } from '../../shifts/actions'
import { paySale, updateSaleClinicalInfo, voidSaleAction } from './actions'
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

const paymentMethods = ['CASH', 'CARD', 'TRANSFER', 'QRIS']

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
