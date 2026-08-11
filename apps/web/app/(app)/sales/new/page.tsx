import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { createClient } from '../../../../utils/supabase/server'
import { requireOpenShift } from '../../shifts/actions'
import { ShiftRow } from '@pharmacy/domain'
import { CartBuilder } from './cart-builder'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// POS blocked when no shift is open.
async function PosBlock() {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-xl bg-card px-8 py-8 text-center ring-1 ring-foreground/10">
      <CircleAlert className="mb-4 size-12 text-slate-400" aria-hidden />
      <h2 className="mb-2 text-base font-semibold text-slate-900">Tidak Ada Shift Aktif</h2>
      <p className="mb-5 text-sm text-slate-500">
        Buka shift terlebih dahulu sebelum memulai transaksi.
      </p>
      <Button render={<Link href="/shifts/new" />}>Buka Shift</Button>
    </div>
  )
}

function parseDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function NewSalePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  // Hard block: require open shift before POS is accessible.
  let openShiftData: ShiftRow | null = null
  try {
    openShiftData = await requireOpenShift()
  } catch {
    return (
      <section className="mx-auto max-w-md space-y-6">
        <div>
          <Link href="/sales" className="mb-4 inline-block text-sm text-primary hover:underline">
            Kembali ke Kasir
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Transaksi Baru</h1>
        </div>
        <PosBlock />
      </section>
    )
  }

  // Non-null here: requireOpenShift throws or we returned above.
  const openShift = openShiftData as ShiftRow

  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, base_unit, allow_fractional, regulatory_category')
    .order('name', { ascending: true })
  const [doctorRes, patientRes] = await Promise.all([
    supabase.from('doctors').select('id, name, sip_number').order('name', { ascending: true }),
    supabase.from('patients').select('id, name, address, bpjs_number, nik, ihs_number').order('name', { ascending: true }),
  ])
  const { data: batches } = await supabase
    .from('product_batches')
    .select('product_id, batch_number, expiry_date, current_qty')
    .gt('current_qty', 0)

  const stockByProduct: Record<string, { batch_number: string; expiry_date: string | null; current_qty: number }[]> = {}
  for (const b of batches || []) {
    if (!stockByProduct[b.product_id]) stockByProduct[b.product_id] = []
    stockByProduct[b.product_id].push(b)
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/sales" className="mb-4 inline-block text-sm text-primary hover:underline">
          Kembali ke Kasir
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-900">Transaksi Baru</h1>
          <span className="text-xs text-slate-500">
            Shift: {openShift.id.slice(0, 8)}… · Dibuka {parseDate(openShift.opened_at)}
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <CartBuilder
        products={products || []}
        doctors={doctorRes.data || []}
        patients={patientRes.data || []}
      />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-slate-900">Stok tersedia (FEFO)</h2>
        {(products || []).length === 0 ? (
          <EmptyState
            title="Belum ada data obat"
            description="Tambah produk dulu sebelum berjualan."
            action={<Button render={<Link href="/products" />}>Tambah Produk</Button>}
          />
        ) : (
          <Table>
            <TableHeader className="sticky top-14 z-10 bg-slate-50">
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Kedaluwarsa</TableHead>
                <TableHead className="text-right">Stok</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(products || []).map((p: any) => {
                const stock = stockByProduct[p.id] || []
                return stock.length === 0 ? null : (
                  stock.map((b) => (
                    <TableRow
                      key={`${p.id}-${b.batch_number}`}
                      className="h-10 cursor-pointer hover:bg-slate-50"
                    >
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{b.batch_number}</TableCell>
                      <TableCell>{b.expiry_date ? parseDate(b.expiry_date) : '-'}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.current_qty}</TableCell>
                    </TableRow>
                  ))
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  )
}
