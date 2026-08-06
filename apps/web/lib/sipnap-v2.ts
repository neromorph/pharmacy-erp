// SIPNAP v2 helpers: parse the RPC payload, gate readiness on the three
// hard-block checks, and build the split CSV for the Kemkes template.

export interface SipnapV2Tx {
  sale_id: string
  sale_number: string
  sold_at: string
  sale_type: string
  doctor_name: string | null
  doctor_sip: string | null
  patient_name: string | null
  patient_address: string | null
  product_name: string
  qty_sold: number
}

export interface SipnapV2Missing {
  sale_id: string
  sale_number: string
  missing_fields: string[]
}

export type SipnapCheckType = 'NEGATIVE' | 'BAP' | 'CONTINUITY'

export interface SipnapCheck {
  type: SipnapCheckType
  product_name?: string
  expected?: number
  actual?: number
}

export interface SipnapV2Product {
  product_id: string
  product_name: string
  saldo_awal: number
  pemasukan_dari_pbf: number
  pemasukan_dari_sarana: number
  pengeluaran_untuk_resep: number
  pengeluaran_untuk_sarana: number
  jumlah_dimusnahkan: number
  status_pemusnahan: string
  bap_number: string | null
  bap_date: string | null
  saldo_akhir: number
}

export interface SipnapV2Report {
  month: number
  year: number
  ready: boolean
  transactions: SipnapV2Tx[]
  missing: SipnapV2Missing[]
  checks: SipnapCheck[]
  products: SipnapV2Product[]
}

// Normalize the RPC json payload into a typed report.
export function parseSipnapV2Report(raw: any): SipnapV2Report {
  return {
    month: Number(raw.month || 0),
    year: Number(raw.year || 0),
    ready: Boolean(raw.ready),
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    missing: Array.isArray(raw.missing) ? raw.missing : [],
    checks: Array.isArray(raw.checks) ? raw.checks : [],
    products: Array.isArray(raw.products) ? raw.products : [],
  }
}

// Export is allowed only when no row is missing and no hard-block fires.
export function isSipnapV2Ready(report: SipnapV2Report): boolean {
  return report.missing.length === 0 && report.checks.length === 0
}

// Render each hard-block check as a human line for the inbox.
export function checksToLines(checks: SipnapCheck[]): string[] {
  return checks.map((c) => {
    if (c.type === 'NEGATIVE') return `Stok Akhir negatif: ${c.product_name}`
    if (c.type === 'BAP') return 'Pemusnahan tanpa BAP'
    if (c.type === 'CONTINUITY') {
      return `Stok awal ${c.product_name} = ${c.actual}, seharusnya ${c.expected}`
    }
    return `Check tidak dikenal: ${c.type}`
  })
}

function escapeCsv(value: string | number | null): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

// Build the export CSV: product summary with the four split columns,
// then the transaction detail log.
export function buildSipnapV2Csv(report: SipnapV2Report): string {
  const header =
    'PRODUK;SALDO AWAL;PEMASUKAN DARI PBF;PEMASUKAN DARI SARANA;' +
    'PENGELUARAN UNTUK RESEP;PENGELUARAN UNTUK SARANA;JUMLAH DIMUSNAHKAN;' +
    'STATUS PEMUSNAHAN;NOMOR BAP;TANGGAL BAP;SALDO AKHIR'
  const productRows = report.products.map((p) =>
    [
      p.product_name,
      p.saldo_awal,
      p.pemasukan_dari_pbf,
      p.pemasukan_dari_sarana,
      p.pengeluaran_untuk_resep,
      p.pengeluaran_untuk_sarana,
      p.jumlah_dimusnahkan,
      p.status_pemusnahan,
      p.bap_number,
      p.bap_date,
      p.saldo_akhir,
    ]
      .map(escapeCsv)
      .join(';')
  )
  const txHeader = 'NOMOR;JENIS;TANGGAL;DOKTER;NO SIP;PASIEN;ALAMAT;PRODUK;JUMLAH'
  const txRows = report.transactions.map((t) =>
    [
      t.sale_number,
      t.sale_type,
      t.sold_at,
      t.doctor_name,
      t.doctor_sip,
      t.patient_name,
      t.patient_address,
      t.product_name,
      t.qty_sold,
    ]
      .map(escapeCsv)
      .join(';')
  )
  return [
    'SIPNAP NARKOTIKA/PSIKOTROPIKA',
    `BULAN;${report.month}`,
    `TAHUN;${report.year}`,
    '',
    header,
    ...productRows,
    '',
    txHeader,
    ...txRows,
  ].join('\n')
}
