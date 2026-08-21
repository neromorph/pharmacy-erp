import { Banknote, AlertTriangle, CalendarClock } from 'lucide-react'
import { createClient } from '../../utils/supabase/server'
import { SetupChecklist } from '@/components/shell/SetupChecklist'
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })

export default async function HomePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_dashboard_kpis')

  let dailySales: number | null = null
  let lowStockCount: number | null = null
  let nearExpiryCount: number | null = null

  if (!error && data) {
    let parsed: any = data
    // SAFETY: get_dashboard_kpis returns a single JSON object; no string wrapping.
    if (parsed) {
      dailySales = Number(parsed.daily_sales) || 0
      lowStockCount = Number(parsed.low_stock_count) || 0
      nearExpiryCount = Number(parsed.near_expiry_count) || 0
    }
  }

  const available = dailySales !== null && lowStockCount !== null && nearExpiryCount !== null

  const cards = [
    {
      label: 'Penjualan Harian',
      value: available ? currency.format(dailySales!) : '—',
      Icon: Banknote,
    },
    {
      label: 'Stok Menipis',
      value: available ? String(lowStockCount!) : '—',
      Icon: AlertTriangle,
    },
    {
      label: 'Mendekati Kedaluwarsa',
      value: available ? String(nearExpiryCount!) : '—',
      Icon: CalendarClock,
    },
  ]

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Dasbor</h1>
      <SetupChecklist />
      {!available ? (
        <p className="text-sm text-slate-500">
          Dasbor tidak tersedia{error ? `: ${error.message}` : ''}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.label}>
              <CardHeader>
                <CardTitle className="text-sm text-slate-500">{card.label}</CardTitle>
                <CardAction>
                  <card.Icon className="size-5 text-slate-400" aria-hidden />
                </CardAction>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-slate-900">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
