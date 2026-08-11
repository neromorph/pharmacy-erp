import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { QtyInput } from './qty-input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const opnameReasons = ['DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC']

const selectClass =
  'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// FEFO hint: shorter shelf life rates the batch higher risk.
function expiryBadge(expiry: string | null) {
  if (!expiry) return <Badge variant="secondary">Tanpa kedaluwarsa</Badge>
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  const label = new Date(expiry).toLocaleDateString()
  if (days < 0) return <Badge variant="destructive">{label} — LEWAT</Badge>
  if (days <= 30) return <Badge variant="destructive">{label} ≤30 hari</Badge>
  if (days <= 90) return <Badge variant="secondary">{label} ≤90 hari</Badge>
  return <Badge variant="outline">{label}</Badge>
}

async function createStockOpname(formData: FormData) {
  'use server'
  const type = (formData.get('type') as string) || 'FULL_STORE'
  const opnameNumber = `SON-${Date.now()}`
  const batchIds = formData.getAll('batch_id') as string[]
  const physicalQtys = formData.getAll('physical_qty') as string[]
  const reasons = formData.getAll('reason') as string[]

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  const { data: opname, error: hErr } = await supabase
    .from('stock_opnames')
    .insert([{ tenant_id: tenantId, opname_number: opnameNumber, type, status: 'DRAFT', created_by: user?.id }])
    .select()
    .single()
  if (hErr) {
    redirect('/stock-opname/new?error=Failed to create opname session')
    return
  }

  // Read current quantities for each batch, compute base variance.
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < batchIds.length; i++) {
    const batchId = batchIds[i]
    const { data: batch } = await supabase
      .from('product_batches')
      .select('product_id, current_qty')
      .eq('id', batchId)
      .single()
    if (!batch) continue
    const systemQty = Number(batch.current_qty)
    const physicalQty = Number(physicalQtys[i] || 0)
    rows.push({
      tenant_id: tenantId,
      opname_id: opname.id,
      product_id: batch.product_id,
      batch_id: batchId,
      system_qty_base: systemQty,
      physical_qty_base: physicalQty,
      variance_qty_base: systemQty - physicalQty,
      reason: reasons[i] || 'MISC',
    })
  }

  const { error: iErr } = await supabase.from('stock_opname_items').insert(rows)
  if (iErr) {
    redirect('/stock-opname/new?error=Failed to add items')
    return
  }

  redirect(`/stock-opname/${opname.id}`)
}

export default async function NewStockOpnamePage() {
  const supabase = await createClient()
  const { data: batches } = await supabase
    .from('product_batches')
    .select('id, batch_number, expiry_date, current_qty, products (name, sku)')
    .order('product_id', { ascending: true })

  if (!batches || batches.length === 0) {
    return <p className="text-sm text-slate-500">No batches in stock to count.</p>
  }

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Opname Stok Baru</h1>
      <form
        action={createStockOpname}
        className="rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="type">Jenis opname</Label>
          <select
            id="type"
            name="type"
            className={`${selectClass} max-w-64`}
            defaultValue="FULL_STORE"
          >
            <option value="FULL_STORE">Seluruh Toko</option>
            <option value="RACK_BASED">Per Rak</option>
            <option value="AD_HOC_SINGLE">Item Tunggal</option>
          </select>
        </div>

        <div className="mt-6 overflow-x-auto">
          <p className="mb-2 text-xs text-slate-500">
            Ubah jumlah fisik hanya jika hitungan berbeda dari sistem. Urutkan FEFO: batch dengan kedaluwarsa terdekat harus habis lebih dulu.
          </p>
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead className="text-right">Sistem</TableHead>
                <TableHead>Fisik</TableHead>
                <TableHead>Alasan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b: any) => (
                <TableRow key={b.id} className="h-10">
                  <TableCell>{b.products?.name || b.sku}</TableCell>
                  <TableCell>{b.batch_number}</TableCell>
                  <TableCell>
                    {expiryBadge(b.expiry_date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(b.current_qty).toFixed(3)}
                  </TableCell>
                  <TableCell className="w-36">
                    <input type="hidden" name="batch_id" value={b.id} />
                    <QtyInput
                      name="physical_qty"
                      defaultValue={Number(b.current_qty)}
                      systemQty={Number(b.current_qty)}
                    />
                  </TableCell>
                  <TableCell className="w-36">
                    <select name="reason" className={selectClass} defaultValue="MISC">
                      {opnameReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Button type="submit" className="mt-6">
          Save Draft
        </Button>
      </form>
    </section>
  )
}