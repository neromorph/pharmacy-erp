import { createClient } from '../../utils/supabase/server'

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })

export default async function HomePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_dashboard_kpis')

  let dailySales: number | null = null
  let lowStockCount: number | null = null
  let nearExpiryCount: number | null = null

  if (!error && data) {
    let parsed: any = data
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data)
      } catch {
        parsed = null
      }
    }
    if (parsed) {
      dailySales = Number(parsed.daily_sales) || 0
      lowStockCount = Number(parsed.low_stock_count) || 0
      nearExpiryCount = Number(parsed.near_expiry_count) || 0
    }
  }

  const available = dailySales !== null && lowStockCount !== null && nearExpiryCount !== null

  const cards = [
    {
      label: 'Daily Sales',
      value: available ? currency.format(dailySales!) : '—',
      accent: 'var(--success)',
    },
    {
      label: 'Low Stock',
      value: available ? String(lowStockCount!) : '—',
      accent: 'var(--warning)',
    },
    {
      label: 'Near Expiry',
      value: available ? String(nearExpiryCount!) : '—',
      accent: 'var(--danger)',
    },
  ]

  return (
    <section>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Dashboard</h1>
      {!available ? (
        <p style={{ color: 'var(--text-secondary)' }}>
          Dashboard unavailable{error ? `: ${error.message}` : ''}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {cards.map((card) => (
            <div
              key={card.label}
              style={{
                flex: '1 1 200px',
                background: 'var(--card)',
                border: `1px solid var(--border)`,
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                {card.label}
              </p>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 28,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {card.value}
              </p>
              <div
                style={{
                  marginTop: 12,
                  height: 3,
                  borderRadius: 2,
                  background: card.accent,
                  width: 48,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
