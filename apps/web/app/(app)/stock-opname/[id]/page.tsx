import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole, canApproveOpname } from '../../../../utils/auth'
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

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  DRAFT: 'secondary',
  PENDING_APPROVAL: 'outline',
  APPROVED: 'default',
  CANCELLED: 'destructive',
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

async function submitStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status !== 'DRAFT') redirect(`/stock-opname/${id}`)
  await supabase.from('stock_opnames').update({ status: 'PENDING_APPROVAL' }).eq('id', id)
  redirect(`/stock-opname/${id}`)
}

async function cancelStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status === 'APPROVED' || op.status === 'CANCELLED') redirect(`/stock-opname/${id}`)
  await supabase.from('stock_opnames').update({ status: 'CANCELLED' }).eq('id', id)
  redirect(`/stock-opname/${id}`)
}

async function approveStockOpname(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (!canApproveOpname(role)) redirect(`/stock-opname/${id}`)

  const { data: op } = await supabase.from('stock_opnames').select('status').eq('id', id).single()
  if (!op || op.status !== 'PENDING_APPROVAL') redirect(`/stock-opname/${id}`)

  // Apply counted quantity to each batch. Only changes stock on approval.
  const { data: items } = await supabase.from('stock_opname_items').select('batch_id, physical_qty_base').eq('opname_id', id)
  for (const item of items || []) {
    await supabase
      .from('product_batches')
      .update({ current_qty: item.physical_qty_base })
      .eq('id', item.batch_id)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase
    .from('stock_opnames')
    .update({ status: 'APPROVED', approved_by: user?.id, approved_at: new Date().toISOString() })
    .eq('id', id)
  redirect(`/stock-opname/${id}`)
}

export default async function StockOpnameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const { data: op } = await supabase
    .from('stock_opnames')
    .select('*')
    .eq('id', id)
    .single()
  const { data: items } = await supabase
    .from('stock_opname_items')
    .select('*, products (name, sku), product_batches (batch_number, expiry_date)')
    .eq('opname_id', id)

  if (!op) {
    return <p className="text-sm text-destructive">Stock opname not found</p>
  }

  return (
    <section className="space-y-6">
      <div>
        <Link href="/stock-opname" className="mb-4 inline-block text-sm text-primary hover:underline">
          Back to Stock Opname
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{op.opname_number}</h1>
          <Badge variant={statusVariant[op.status] || 'secondary'}>{op.status}</Badge>
          <span className="text-sm text-slate-500">{op.type}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Dibuat: {parseDate(op.created_at)} • Disetujui: {op.approved_at ? parseDate(op.approved_at) : '-'}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Produk</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Kedaluwarsa</TableHead>
              <TableHead className="text-right">Sistem</TableHead>
              <TableHead className="text-right">Fisik</TableHead>
              <TableHead className="text-right">Selisih</TableHead>
              <TableHead>Alasan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(items || []).map((it: any) => (
              <TableRow key={it.id} className="h-10">
                <TableCell>{it.products?.name || it.product_id}</TableCell>
                <TableCell>{it.product_batches?.batch_number || '-'}</TableCell>
                <TableCell>
                  {it.product_batches?.expiry_date ? parseDate(it.product_batches.expiry_date) : '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.system_qty_base).toFixed(3)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.physical_qty_base).toFixed(3)}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(it.variance_qty_base).toFixed(3)}</TableCell>
                <TableCell>{it.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        {op.status === 'DRAFT' && (
          <>
            <form action={submitStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <Button type="submit">Ajukan untuk Disetujui</Button>
            </form>
            <form action={cancelStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <Button type="submit" variant="destructive">Batalkan</Button>
            </form>
          </>
        )}
        {op.status === 'PENDING_APPROVAL' && canApproveOpname(role) && (
          <>
            <form action={approveStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <Button type="submit">Setujui</Button>
            </form>
            <form action={cancelStockOpname}>
              <input type="hidden" name="id" value={op.id} />
              <Button type="submit" variant="destructive">Batalkan</Button>
            </form>
          </>
        )}
        {op.status === 'PENDING_APPROVAL' && !canApproveOpname(role) && (
          <p className="text-sm text-slate-500">Menunggu persetujuan pemilik atau apoteker.</p>
        )}
      </div>
    </section>
  )
}