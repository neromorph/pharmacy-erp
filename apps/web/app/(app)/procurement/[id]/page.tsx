import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { parseDate } from '../status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface StatusBadgeMap {
  DRAFT: 'outline'
  PENDING_APPROVAL: 'secondary'
  APPROVED: 'default'
  RECEIVED: 'secondary'
  CANCELLED: 'destructive'
}
const statusBadge: StatusBadgeMap = {
  DRAFT: 'outline',
  PENDING_APPROVAL: 'secondary',
  APPROVED: 'default',
  RECEIVED: 'secondary',
  CANCELLED: 'destructive',
}

async function submitPurchaseOrder(formData: FormData) {
  'use server'
  // SAFETY: hidden form input 'id' is always a non-null UUID string.
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'DRAFT') return redirect(`/procurement/${id}`)
  await supabase
    .from('purchase_orders')
    .update({ status: 'PENDING_APPROVAL' })
    .eq('id', id)
  redirect(`/procurement/${id}`)
}

async function approvePurchaseOrder(formData: FormData) {
  'use server'
  // SAFETY: hidden form input 'id' is always a non-null UUID string.
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'PENDING_APPROVAL') {
    redirect(`/procurement/${id}`)
    return
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase
    .from('purchase_orders')
    .update({ status: 'APPROVED', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', id)
  redirect(`/procurement/${id}`)
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('*, suppliers (name)')
    .eq('id', id)
    .single()
  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('*, products (name, sku)')
    .eq('purchase_order_id', id)

  if (!po) {
    return <p className="text-sm text-destructive">Pesanan pembelian tidak ditemukan</p>
  }

  // SAFETY: po.status is always one of the ProcurementStatus values from the query.
  const badgeVariant = statusBadge[po.status as keyof StatusBadgeMap] || 'secondary'

  return (
    <section className="space-y-6">
      <div>
        <Link href="/procurement" className="text-sm text-primary hover:underline">
          Kembali ke Pengadaan
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{po.po_number}</h1>
          <Badge variant={badgeVariant}>{po.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Pemasok: {po.suppliers?.name || '-'} • Dipesan: {parseDate(po.ordered_at || po.created_at)}
          {po.approved_at ? ` • Disetujui: ${parseDate(po.approved_at)} oleh ${(po.approved_by || '').toString().slice(0, 8)}` : ''}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead className="text-right">Harga Satuan</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items || []).map((it: any) => (
              <TableRow key={it.id} className="h-10">
                <TableCell>{it.products?.name || '-'}</TableCell>
                <TableCell>{it.products?.sku || '-'}</TableCell>
                <TableCell className="text-right tabular-nums">{it.qty_ordered}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.unit_price).toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.line_total).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {po.status === 'DRAFT' && (
        <form>
          <input type="hidden" name="id" value={po.id} />
          <Button type="submit" formAction={submitPurchaseOrder}>
            Ajukan Persetujuan
          </Button>
        </form>
      )}
      {po.status === 'PENDING_APPROVAL' && (
        <form>
          <input type="hidden" name="id" value={po.id} />
          <Button type="submit" formAction={approvePurchaseOrder}>
            Setujui
          </Button>
        </form>
      )}
      {po.status === 'APPROVED' && (
        <Button render={<Link href={`/procurement/${po.id}/receive`} />}>Terima Barang</Button>
      )}
    </section>
  )
}
