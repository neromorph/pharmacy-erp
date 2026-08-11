import { CheckCircle2, Circle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// One first-run checklist on the dashboard. Links to existing pages.
// Hide the card once the tenant has made its first sale.
export async function SetupChecklist() {
  const supabase = await createClient()

  const count = async (table: string): Promise<number> => {
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true })
    return count ?? 0
  }

  const [profiles, products, suppliers, batches, openShifts, sales] = await Promise.all([
    supabase.from('tenants').select('name, sia_number, sipa_number').limit(1).maybeSingle(),
    count('products'),
    count('suppliers'),
    count('product_batches'),
    supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('status', 'OPEN'),
    count('sales'),
  ])

  const hasOpenShift = (openShifts.count ?? 0) > 0

  const steps = [
    {
      label: 'Lengkapi identitas toko (nama, SIA/SIPA)',
      href: '/settings',
      done: Boolean(profiles.data?.name && (profiles.data?.sia_number || profiles.data?.sipa_number)),
    },
    { label: 'Buka shift kasir', href: '/shifts', done: hasOpenShift },
    { label: 'Tambah pemasok', href: '/suppliers', done: suppliers > 0 },
    { label: 'Tambah data obat (produk)', href: '/products', done: products > 0 },
    { label: 'Terima batch stok pertama', href: '/procurement', done: batches > 0 },
    { label: 'Buat transaksi pertama', href: '/sales', done: sales > 0 },
  ]

  const doneCount = steps.filter((s) => s.done).length
  const allDone = doneCount === steps.length
  if (allDone) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-slate-500">
          Langkah awal — {doneCount} dari {steps.length} selesai
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((step) => (
            <li key={step.href}>
              <a
                href={step.href}
                className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary"
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-slate-300" aria-hidden />
                )}
                <span className={step.done ? 'text-slate-400 line-through' : ''}>{step.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}