import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../../utils/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

async function receiveGoods(formData: FormData) {
  'use server'
  const id = formData.get('purchase_order_id') as string
  const receiptNumber = formData.get('receipt_number') as string
  const invoiceNumber = formData.get('invoice_number') as string
  const purchaseOrderItemIds = formData.getAll('purchase_order_item_id') as string[]
  const productIds = formData.getAll('product_id') as string[]
  const batchNumbers = formData.getAll('batch_number') as string[]
  const expiryDates = formData.getAll('expiry_date') as string[]
  const qtys = formData.getAll('qty_received') as string[]
  const unitCosts = formData.getAll('unit_cost') as string[]

  if (!receiptNumber || !invoiceNumber || purchaseOrderItemIds.length === 0) {
    redirect(`/procurement/${id}/receive?error=Missing required fields`)
    return
  }

  const supabase = await createClient()
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('tenant_id, status')
    .eq('id', id)
    .single()

  if (!po || po.status !== 'APPROVED') {
    redirect(`/procurement/${id}`)
    return
  }

  const { data: gr, error: gErr } = await supabase
    .from('goods_receipts')
    .insert([
      {
        tenant_id: po.tenant_id,
        purchase_order_id: id,
        receipt_number: receiptNumber,
        invoice_number: invoiceNumber,
        received_at: new Date().toISOString(),
      },
    ])
    .select()
    .single()

  if (gErr) {
    redirect(`/procurement/${id}/receive?error=Failed to create goods receipt`)
    return
  }

  const receiptItems = purchaseOrderItemIds.map((poItemId, i) => ({
    tenant_id: po.tenant_id,
    goods_receipt_id: gr.id,
    purchase_order_item_id: poItemId,
    product_id: productIds[i],
    batch_number: batchNumbers[i],
    expiry_date: expiryDates[i],
    qty_received: Number(qtys[i] || 0),
    unit_cost: Number(unitCosts[i] || 0),
    line_total: Number(qtys[i] || 0) * Number(unitCosts[i] || 0),
  }))

  const batches = purchaseOrderItemIds.map((poItemId, i) => ({
    tenant_id: po.tenant_id,
    product_id: productIds[i],
    batch_number: batchNumbers[i],
    expiry_date: expiryDates[i],
    current_qty: Number(qtys[i] || 0),
  }))

  const { error: iErr } = await supabase.from('goods_receipt_items').insert(receiptItems)
  if (iErr) {
    redirect(`/procurement/${id}/receive?error=Failed to add receipt items`)
    return
  }

  const { error: bErr } = await supabase.from('product_batches').insert(batches)
  if (bErr) {
    redirect(`/procurement/${id}/receive?error=Failed to update stock`)
    return
  }

  const { error: uErr } = await supabase
    .from('purchase_orders')
    .update({ status: 'RECEIVED', received_at: new Date().toISOString() })
    .eq('id', id)
  if (uErr) {
    redirect(`/procurement/${id}/receive?error=Failed to complete purchase order`)
    return
  }

  redirect(`/procurement/${id}`)
}

export default async function ReceiveGoodsPage({
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

  if (!po || po.status !== 'APPROVED') {
    return (
      <section className="space-y-2">
        <Link href="/procurement" className="text-sm text-primary hover:underline">
          Kembali ke Pengadaan
        </Link>
        <p className="text-sm text-destructive">Hanya pesanan pembelian yang disetujui yang dapat diterima</p>
        <Link href={`/procurement/${id}`} className="text-sm text-primary hover:underline">
          Kembali ke pesanan pembelian
        </Link>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href={`/procurement/${id}`} className="text-sm text-primary hover:underline">
          Kembali ke Pesanan Pembelian
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Terima Barang</h1>
        <p className="mt-1 text-sm text-slate-500">
          {po.po_number} • Pemasok: {po.suppliers?.name || '-'}
        </p>
      </div>

      <form action={receiveGoods} className="max-w-3xl space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <input type="hidden" name="purchase_order_id" value={po.id} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="receipt_number">Nomor Penerimaan</Label>
            <Input id="receipt_number" name="receipt_number" required placeholder="GR-2026-0001" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invoice_number">Nomor Faktur</Label>
            <Input id="invoice_number" name="invoice_number" required placeholder="INV-2026-0001" />
          </div>
        </div>

        <h2 className="text-sm font-medium text-slate-900">Item Barang</h2>
        <div className="grid gap-3">
          {(items || []).map((it: any) => (
            <div
              key={it.id}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] items-end gap-2 rounded-lg border border-border/60 p-3"
            >
              <input type="hidden" name="purchase_order_item_id" value={it.id} />
              <input type="hidden" name="product_id" value={it.product_id} />
              <div className="grid gap-1">
                <Label className="text-xs">Produk</Label>
                <span className="text-sm">
                  {it.products?.name || '-'} ({it.products?.sku || '-'})
                </span>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`batch-${it.id}`} className="text-xs">Batch</Label>
                <Input id={`batch-${it.id}`} name="batch_number" required placeholder="Nomor batch" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`expiry-${it.id}`} className="text-xs">Kedaluwarsa</Label>
                <Input id={`expiry-${it.id}`} name="expiry_date" type="date" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`qty-${it.id}`} className="text-xs">Jumlah</Label>
                <Input
                  id={`qty-${it.id}`}
                  name="qty_received"
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  placeholder={String(it.qty_ordered)}
                  className="w-24"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`cost-${it.id}`} className="text-xs">Harga Satuan</Label>
                <Input
                  id={`cost-${it.id}`}
                  name="unit_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder={String(Number(it.unit_price).toFixed(2))}
                  className="w-24"
                />
              </div>
            </div>
          ))}
        </div>

        <Button type="submit">Terima Barang</Button>
      </form>
    </section>
  )
}
