import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getKartuStokRows } from './actions'
import { buildKartuStokRows, formatKartuStokMovement, REGULATORY_CATEGORIES } from '../../../lib/kartu-stok'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

// Build a query string that preserves active filters and sets the view.
function viewQuery(
  filters: { q?: string; date_from?: string; date_to?: string; regulatory_category?: string },
  view: string
): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.regulatory_category) params.set('regulatory_category', filters.regulatory_category)
  params.set('view', view)
  return params.toString()
}

const typeBadge: Record<string, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  IN: 'default',
  OUT: 'destructive',
  ADJUSTMENT: 'outline',
  VOID: 'secondary',
}

function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('id-ID', { dateStyle: 'medium', hour: '2-digit', minute: '2-digit' })
}

interface PageProps {
  searchParams: Promise<{ q?: string; date_from?: string; date_to?: string; regulatory_category?: string; view?: string }>
}

export default async function KartuStokPage({ searchParams }: PageProps) {
  const params = await searchParams
  const filters = {
    q: params.q,
    date_from: params.date_from,
    date_to: params.date_to,
    regulatory_category: params.regulatory_category,
  }
  const view = params.view === 'batch' ? 'batch' : 'product'

  const supabase = await createClient()

  // Check for approved opname anchor
  const { data: { user } } = await supabase.auth.getUser()
  let hasAnchor = false
  if (user) {
    const tenantId = user.app_metadata?.tenant_id as string | undefined
    if (tenantId) {
      const { data } = await supabase
        .from('stock_opnames')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'APPROVED')
        .order('approved_at', { ascending: true })
        .limit(1)
      hasAnchor = !!data
    }
  }

  // Empty state — no approved opname
  if (!hasAnchor) {
    return (
      <section className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">Kartu Stok</h1>
        <div className="rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10">
          <p className="mb-4 text-sm text-slate-500">
            No approved stock opname found for this store.
          </p>
          <p className="mb-6 text-xs text-slate-500">
            Run an initial stock opname to seed the opening balance.
          </p>
          <Button render={<Link href="/stock-opname/new" />}>New Stock Opname</Button>
        </div>
      </section>
    )
  }

  // Load data
  const { rows: rawRows } = await getKartuStokRows(filters)
  const rows = buildKartuStokRows(rawRows)

  // Load products for display names
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .order('name', { ascending: true })
  const productMap = new Map((products || []).map((p: any) => [p.id, p.name]))

  // Group rows by product_id; within a product, optionally by batch.
  const grouped: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!grouped[row.product_id]) grouped[row.product_id] = []
    grouped[row.product_id].push(row)
  }

  // Batch sub-groups per product (used in batch view).
  const batchesByProduct: Record<string, Record<string, typeof rows>> = {}
  if (view === 'batch') {
    for (const [productId, productRows] of Object.entries(grouped)) {
      const byBatch: Record<string, typeof rows> = {}
      for (const row of productRows) {
        const key = row.batch_number || '(no batch)'
        if (!byBatch[key]) byBatch[key] = []
        byBatch[key].push(row)
      }
      batchesByProduct[productId] = byBatch
    }
  }

  const selectClass =
    'h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Kartu Stok</h1>
        <span className="text-xs text-slate-500">
          {rows.length} movement{rows.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Filters */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-4 rounded-xl bg-card px-4 py-4 ring-1 ring-foreground/10"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="q">Produk</Label>
          <Input
            id="q"
            type="text"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="Cari berdasarkan nama produk atau SKU"
            className="min-w-48"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="date_from">Tanggal Dari</Label>
          <Input id="date_from" type="date" name="date_from" defaultValue={filters.date_from ?? ''} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="date_to">Tanggal Sampai</Label>
          <Input id="date_to" type="date" name="date_to" defaultValue={filters.date_to ?? ''} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="regulatory_category">Golongan Obat</Label>
          <select
            id="regulatory_category"
            name="regulatory_category"
            defaultValue={filters.regulatory_category ?? ''}
            className={selectClass}
          >
            <option value="">Semua</option>
            {REGULATORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {filters.q || filters.date_from || filters.date_to || filters.regulatory_category ? (
            <Link href="/kartu-stok" className="text-xs text-slate-500 hover:text-slate-700">
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      {/* View toggle: product-grouped (default) or batch-grouped */}
      <div className="flex gap-2">
        <Button
          render={<Link href={`/kartu-stok?${viewQuery(filters, 'product')}`} />}
          variant={view === 'product' ? 'default' : 'outline'}
          size="sm"
        >
          By Product
        </Button>
        <Button
          render={<Link href={`/kartu-stok?${viewQuery(filters, 'batch')}`} />}
          variant={view === 'batch' ? 'default' : 'outline'}
          size="sm"
        >
          By Batch
        </Button>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada mutasi ditemukan untuk filter yang dipilih.</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {Object.entries(grouped).map(([productId, productRows]) => (
            <div key={productId}>
              {/* Product header */}
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-medium text-slate-900">
                  {productMap.get(productId) ?? productId}
                </span>
                <span className="text-xs text-slate-500">
                  {productRows.length} row{productRows.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Batch sub-groups (batch view) */}
              {view === 'batch' && (
                <div>
                  {Object.entries(batchesByProduct[productId] || {}).map(([batchKey, batchRows]) => (
                    <div key={batchKey}>
                      <div className="border-t border-border/60 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-500">
                        Batch: {batchKey}
                      </div>
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Jenis</TableHead>
                            <TableHead className="text-right">Jml</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchRows.map((row, i) => (
                            <TableRow key={`${row.source_id}-${i}`} className="h-10">
                              <TableCell>{parseDate(row.occurred_at)}</TableCell>
                              <TableCell>
                                <Badge variant={typeBadge[row.type] || 'secondary'}>
                                  {formatKartuStokMovement(row.type)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.qty > 0 ? `+${row.qty}` : row.qty}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {row.balance.toFixed(3)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}

              {/* Flat rows (product view) */}
              {view !== 'batch' && (
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Kedaluwarsa</TableHead>
                      <TableHead className="text-right">Jml</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productRows.map((row, i) => (
                      <TableRow key={`${row.source_id}-${i}`} className="h-10">
                        <TableCell>{parseDate(row.occurred_at)}</TableCell>
                        <TableCell>
                          <Badge variant={typeBadge[row.type] || 'secondary'}>
                            {formatKartuStokMovement(row.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.batch_number || '-'}</TableCell>
                        <TableCell>{row.expiry_date ?? '-'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.qty > 0 ? `+${row.qty}` : row.qty}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {row.balance.toFixed(3)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}