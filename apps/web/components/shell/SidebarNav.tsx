'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardCheck,
  Clock,
  FileText,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Trash2,
  Truck,
  Undo2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { NAV_GROUPS, type NavItem } from './nav-map'

// Map each nav href to its icon. Unknown links fall back to a dot.
const ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/sales': ShoppingCart,
  '/shifts': Clock,
  '/products': Package,
  '/kartu-stok': ScrollText,
  '/stock-opname': ClipboardCheck,
  '/stock/destructions': Trash2,
  '/suppliers': Truck,
  '/procurement': FileText,
  '/procurement/returns': Undo2,
  '/finance/payables': Wallet,
  '/reports/sipnap': ShieldCheck,
  '/doctors': Stethoscope,
  '/patients': Users,
  '/settings': Settings,
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = ICONS[item.href] ?? Dot
  const active = isActive(pathname, item.href)

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
        active
          ? 'bg-primary/5 font-medium text-primary'
          : 'text-slate-700 hover:bg-slate-100'
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  )
}

// Renders the approved 7-group nav map. Shared by desktop sidebar and mobile sheet.
export function SidebarNav() {
  const pathname = usePathname()
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <div className="px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wider text-slate-500 uppercase">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function Dot(props: { className?: string }) {
  return <span className={cn('size-1.5 rounded-full bg-slate-300', props.className)} />
}