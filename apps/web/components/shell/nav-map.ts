export interface NavItem {
  label: string
  href: string
  primary?: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

// Approved navigation map: 7 groups, fixed order.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Dashboard', href: '/' },
      { label: 'Sales', href: '/sales', primary: true },
      { label: 'Shifts', href: '/shifts' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Products', href: '/products' },
      { label: 'Kartu Stok', href: '/kartu-stok' },
      { label: 'Stock Opname', href: '/stock-opname' },
      { label: 'Pemusnahan', href: '/stock/destructions' },
    ],
  },
  {
    title: 'Procurement',
    items: [
      { label: 'Suppliers', href: '/suppliers' },
      { label: 'Purchase Orders', href: '/procurement' },
      { label: 'Returns', href: '/procurement/returns' },
    ],
  },
  {
    title: 'Finance',
    items: [{ label: 'Payables', href: '/finance/payables' }],
  },
  {
    title: 'Compliance',
    items: [{ label: 'SIPNAP', href: '/reports/sipnap' }],
  },
  {
    title: 'Master Data',
    items: [
      { label: 'Doctors', href: '/doctors' },
      { label: 'Patients', href: '/patients' },
    ],
  },
  {
    title: 'System',
    items: [{ label: 'Settings', href: '/settings' }],
  },
]