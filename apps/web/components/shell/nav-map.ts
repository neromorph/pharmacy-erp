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
    title: 'Operasional',
    items: [
      { label: 'Dasbor', href: '/' },
      { label: 'Kasir', href: '/sales', primary: true },
      { label: 'Shift Kasir', href: '/shifts' },
    ],
  },
  {
    title: 'Persediaan',
    items: [
      { label: 'Data Obat', href: '/products' },
      { label: 'Kartu Stok', href: '/kartu-stok' },
      { label: 'Stock Opname', href: '/stock-opname' },
      { label: 'Pemusnahan', href: '/stock/destructions' },
    ],
  },
  {
    title: 'Pengadaan',
    items: [
      { label: 'Data Pemasok', href: '/suppliers' },
      { label: 'Pesanan Pembelian (PO)', href: '/procurement' },
      { label: 'Retur Pembelian', href: '/procurement/returns' },
    ],
  },
  {
    title: 'Keuangan',
    items: [{ label: 'Hutang Dagang', href: '/finance/payables' }],
  },
  {
    title: 'Pelaporan',
    items: [{ label: 'SIPNAP', href: '/reports/sipnap' }],
  },
  {
    title: 'Data Master',
    items: [
      { label: 'Dokter', href: '/doctors' },
      { label: 'Pasien', href: '/patients' },
    ],
  },
  {
    title: 'Sistem',
    items: [{ label: 'Pengaturan', href: '/settings' }],
  },
]