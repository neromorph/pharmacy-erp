import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { parseSipnapV2Report, isSipnapV2Ready, checksToLines } from '../../../../lib/sipnap-v2'
import { DownloadButton } from './download-button'
import { HistoryTab, type ExportRow } from './history'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function SipnapReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; tab?: string; page?: string }>
}) {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p className="text-sm text-destructive">Access denied. OWNER or PHARMACIST only.</p>
  }

  const params = await searchParams
  const now = new Date()
  const month = Number(params.month) || now.getMonth() + 1
  const year = Number(params.year) || now.getFullYear()
  const tab = params.tab === 'history' ? 'history' : 'generate'

  const tabBar = (
    <div className="flex gap-2">
      <Button
        render={<Link href={`/reports/sipnap?tab=generate&month=${month}&year=${year}`} />}
        variant={tab === 'generate' ? 'default' : 'outline'}
        size="sm"
      >
        Generate Report
      </Button>
      <Button
        render={<Link href={`/reports/sipnap?tab=history`} />}
        variant={tab === 'history' ? 'default' : 'outline'}
        size="sm"
      >
        History
      </Button>
    </div>
  )

  // History tab: newest-first stored snapshots, 25 per page.
  if (tab === 'history') {
    const page = Math.max(1, Number(params.page) || 1)
    const from = (page - 1) * 25
    const { data: exports } = await supabase
      .from('sipnap_exports')
      .select('id, report_month, report_year, generated_at, generated_by, transaction_count, product_count, file_hash')
      .order('generated_at', { ascending: false })
      .range(from, from + 24)

    return (
      <section className="max-w-[980px] space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">SIPNAP Report</h1>
        {tabBar}
        <HistoryTab exports={(exports || []) as ExportRow[]} />
        <div className="flex gap-3 text-sm text-primary">
          {page > 1 ? (
            <Link href={`/reports/sipnap?tab=history&page=${page - 1}`} className="hover:underline">
              ← Previous
            </Link>
          ) : null}
          {(exports || []).length === 25 ? (
            <Link href={`/reports/sipnap?tab=history&page=${page + 1}`} className="hover:underline">
              Next →
            </Link>
          ) : null}
        </div>
      </section>
    )
  }

  // Generate tab.
  const { data, error } = await supabase.rpc('get_sipnap_report', { p_month: month, p_year: year })
  if (error || !data) {
    return (
      <section className="max-w-[860px] space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">SIPNAP Report</h1>
        {tabBar}
        <p className="text-sm text-destructive">Report failed: {String(error?.message || 'no data')}</p>
      </section>
    )
  }

  const report = parseSipnapV2Report(data)
  const ready = isSipnapV2Ready(report)
  const checkLines = checksToLines(report.checks)
  const totals = report.products.reduce(
    (acc, p) => ({
      pbf: acc.pbf + Number(p.pemasukan_dari_pbf || 0),
      saranaIn: acc.saranaIn + Number(p.pemasukan_dari_sarana || 0),
      resep: acc.resep + Number(p.pengeluaran_untuk_resep || 0),
      saranaOut: acc.saranaOut + Number(p.pengeluaran_untuk_sarana || 0),
      destroyed: acc.destroyed + Number(p.jumlah_dimusnahkan || 0),
    }),
    { pbf: 0, saranaIn: 0, resep: 0, saranaOut: 0, destroyed: 0 }
  )

  return (
    <section className="max-w-[860px] space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">SIPNAP Report</h1>
      {tabBar}

      <form method="GET" className="flex items-end gap-2">
        <input type="hidden" name="tab" value="generate" />
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-500">Month</span>
          <Input type="number" name="month" min={1} max={12} defaultValue={month} className="w-24" />
        </div>
        <div className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-500">Year</span>
          <Input type="number" name="year" min={2020} max={2100} defaultValue={year} className="w-24" />
        </div>
        <Button type="submit">Load</Button>
      </form>

      {report.missing.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Missing Data</h2>
          <p className="text-sm text-slate-500">Fix these transactions before export is enabled.</p>
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Missing fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.missing.map((m) => (
                  <TableRow key={m.sale_id} className="h-10">
                    <TableCell>
                      <Link href={`/sales/${m.sale_id}`} className="text-primary hover:underline">
                        {m.sale_number}
                      </Link>
                    </TableCell>
                    <TableCell>{m.missing_fields.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      {report.checks.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Hard-Block Checks</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {checkLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.missing.length === 0 && report.checks.length === 0 ? (
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
          <p className="text-sm">
            Pemasukan Dari PBF: <strong className="tabular-nums">{totals.pbf.toFixed(2)}</strong>
          </p>
          <p className="text-sm">
            Pemasukan Dari Sarana: <strong className="tabular-nums">{totals.saranaIn.toFixed(2)}</strong>
          </p>
          <p className="text-sm">
            Pengeluaran Untuk Resep: <strong className="tabular-nums">{totals.resep.toFixed(2)}</strong>
          </p>
          <p className="text-sm">
            Pengeluaran Untuk Sarana: <strong className="tabular-nums">{totals.saranaOut.toFixed(2)}</strong>
          </p>
          <p className="pt-1 text-sm">
            Dimusnahkan: <strong className="tabular-nums">{totals.destroyed.toFixed(2)}</strong>
          </p>
          <div className="pt-2">
            <DownloadButton report={report} />
          </div>
        </div>
      ) : null}

      {!ready && (
        <p className="text-sm text-slate-500">
          Export is disabled until all missing data and hard-block checks are resolved.
        </p>
      )}
    </section>
  )
}
