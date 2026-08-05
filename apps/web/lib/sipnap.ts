export interface SipnapTx {
  sale_id: string
  sale_number: string
  sold_at: string
  doctor_name: string | null
  doctor_sip: string | null
  patient_name: string | null
  patient_address: string | null
  product_name: string
  qty_sold: number
}

export interface SipnapMissing {
  sale_id: string
  sale_number: string
  missing_fields: string[]
}

export interface SipnapProduct {
  product_name: string
  saldo_awal: number
  pemasukan: number
  pengeluaran: number
  status_pemusnahan: string
  saldo_akhir: number
}

export interface SipnapReport {
  month: number
  year: number
  ready: boolean
  transactions: SipnapTx[]
  missing: SipnapMissing[]
  products: SipnapProduct[]
}

// Normalize the RPC json payload into a typed report.
export function parseSipnapReport(raw: any): SipnapReport {
  return {
    month: Number(raw.month || 0),
    year: Number(raw.year || 0),
    ready: Boolean(raw.ready),
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    missing: Array.isArray(raw.missing) ? raw.missing : [],
    products: Array.isArray(raw.products) ? raw.products : [],
  }
}

// Export is allowed only when no transaction is missing data.
export function isSipnapReady(report: SipnapReport): boolean {
  return report.missing.length === 0
}

function escapeCsv(value: string | number | null): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

// Build one CSV file with the product summary and the transaction log.
export function buildSipnapCsv(report: SipnapReport): string {
  const header = 'PRODUK;SALDO AWAL;PEMASUKAN;PENGELUARAN;STATUS PEMUSNAHAN;SALDO AKHIR'
  const productRows = report.products.map((p) =>
    [p.product_name, p.saldo_awal, p.pemasukan, p.pengeluaran, p.status_pemusnahan, p.saldo_akhir]
      .map(escapeCsv)
      .join(';')
  )
  const txHeader = 'NOMOR;TANGGAL;DOKTER;NO SIP;PASIEN;ALAMAT;PRODUK;JUMLAH'
  const txRows = report.transactions.map((t) =>
    [t.sale_number, t.sold_at, t.doctor_name, t.doctor_sip, t.patient_name, t.patient_address, t.product_name, t.qty_sold]
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
