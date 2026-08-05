import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pharmacy ERP',
  description: 'POS, procurement, and stock for one branch tenant.',
}

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/shifts', label: 'Shifts' },
  { href: '/sales', label: 'Sales' },
  { href: '/products', label: 'Products' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/procurement', label: 'Procurement' },
  { href: '/finance/payables', label: 'Payables' },
  { href: '/kartu-stok', label: 'Kartu Stok' },
  { href: '/stock-opname', label: 'Stock Opname' },
  { href: '/reports/sipnap', label: 'SIPNAP' },
  { href: '/doctors', label: 'Doctors' },
  { href: '/patients', label: 'Patients' },
  { href: '/settings', label: 'Settings' },
]

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--card)',
          }}
        >
          <Link href="/" style={{ fontWeight: 600, color: 'var(--primary)' }}>
            Pharmacy ERP
          </Link>
          <nav style={{ display: 'flex', gap: 16 }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main style={{ padding: '24px', background: 'var(--surface)', minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  )
}