import { Menu } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { SubmitButton } from '@/components/submit-button'
import { logout } from './actions'
import { ROLE_LABELS } from '@/utils/auth'
import type { UserRole } from '@pharmacy/domain'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SidebarNav } from './SidebarNav'
import type { ShiftStatus } from './shift'

interface TopHeaderProps {
  user: { email: string | null; role: string | null }
  tenant: { name: string | null }
  shift: ShiftStatus
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

// Sticky top bar: mobile nav trigger, tenant, shift status dot, role, avatar.
export function TopHeader({ user, tenant, shift }: TopHeaderProps) {
  const initial = user.email?.charAt(0).toUpperCase() ?? 'U'
  const opened = formatTime(shift.openedAt)

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-6">
      <Sheet>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Buka menu" />}
          className="md:hidden"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigasi</SheetTitle>
          <SidebarNav />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block md:flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {tenant.name ?? 'Pharmacy ERP'}
        </p>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3 md:flex-none">
        <div className="flex items-center gap-2" title={shift.open ? 'Shift Aktif' : 'Tidak ada shift aktif'}>
          <span
            className={
              shift.open
                ? 'size-2 motion-safe:animate-pulse rounded-full bg-emerald-500'
                : 'size-2 rounded-full bg-slate-300'
            }
          />
          <span className="text-xs text-slate-500">
            {shift.open ? `Shift Aktif · ${opened ?? ''}` : 'Tidak ada shift aktif'}
          </span>
        </div>

        {user.role && (
          <Badge
            variant="secondary"
            title={`${ROLE_LABELS[user.role as UserRole]?.name ?? user.role}: ${ROLE_LABELS[user.role as UserRole]?.hint ?? ''}`}
          >
            {user.role}
          </Badge>
        )}

        <Button render={<Link href="/account" />} variant="ghost" size="sm">
          Akun
        </Button>
        <form action={logout}>
          <SubmitButton variant="ghost" size="sm">Keluar</SubmitButton>
        </form>
        <div className="grid size-7 place-items-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
          {initial}
        </div>
      </div>
    </header>
  )
}