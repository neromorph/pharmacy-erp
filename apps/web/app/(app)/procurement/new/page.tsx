import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

async function createPurchaseOrder(formData: FormData) {
  'use server'
  // SAFETY: asserted value is validated before use or known from the source.
  const supplierId = formData.get('supplier_id') as string
  // SAFETY: asserted value is validated before use or known from the source.
  const poNumber = formData.get('po_number') as string
  // SAFETY: asserted value is validated before use or known from the source.
  const productIds = formData.getAll('product_id') as string[]
  // SAFETY: asserted value is validated before use or known from the source.
  const qtys = formData.getAll('qty_ordered') as string[]
  // SAFETY: asserted value is validated before use or known from the source.
  const prices = formData.getAll('unit_price') as string[]

  if (!supplierId || !poNumber || productIds.length === 0) {
    redirect('/procurement/new?error=Missing required fields')
    return
  }

  const supabase = await createClient()
  const { data: po, error: hErr } = await supabase
    .from('purchase_orders')
    .insert([
      {
        supplier_id: supplierId,
        po_number: poNumber,
        status: 'DRAFT',
      },
    ])
    .select()
    .single()

  if (hErr) {
    redirect('/procurement/new?error=Failed to create PO')
    return
  }

  const rows = productIds.map((productId, i) => ({
    purchase_order_id: po.id,
    product_id: productId,
    qty_ordered: Number(qtys[i] || 0),
    unit_price: Number(prices[i] || 0),
    line_total: Number(qtys[i] || 0) * Number(prices[i] || 0),
  }))

  const { error: iErr } = await supabase.from('purchase_order_items').insert(rows)
  if (iErr) {
    redirect(`/procurement/new?error=Failed to add items`)
    return
  }

  redirect(`/procurement/${po.id}`)
}

const selectClass =
  'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export default async function NewPurchaseOrderPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('name', { ascending: true })
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku')
    .order('name', { ascending: true })

  return (
    <section className="space-y-6">
      <div>
        <Link href="/procurement" className="text-sm text-primary hover:underline">
          Kembali ke Pengadaan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Pesanan Pembelian Baru</h1>
      </div>

      <form action={createPurchaseOrder} className="max-w-2xl space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="grid gap-1.5">
          <Label htmlFor="po_number">Nomor PO</Label>
          <Input id="po_number" name="po_number" required placeholder="PO-2026-0001" />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="supplier_id">Pemasok</Label>
          <select id="supplier_id" name="supplier_id" required className={selectClass}>
            <option value="">Pilih pemasok</option>
            {(suppliers || []).map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <h2 className="text-sm font-medium text-slate-900">Item Barang</h2>
        <div id="items" className="grid gap-2">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
            <select name="product_id" required className={selectClass}>
              <option value="">Produk</option>
              {(products || []).map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
            <Input name="qty_ordered" type="number" step="0.001" min="0" required placeholder="Jumlah" />
            <Input name="unit_price" type="number" step="0.01" min="0" required placeholder="Harga" />
          </div>
        </div>

        <Button type="submit">Buat PO (Draft)</Button>
      </form>
    </section>
  )
}
