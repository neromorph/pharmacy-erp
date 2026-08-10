import Link from 'next/link'
import { createClient } from '../../../../utils/supabase/server'
import { getUserRole } from '../../../../utils/auth'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function parseDate(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}

export default async function DestructionsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST') {
    return <p className="text-sm text-destructive">Access denied. Owner or pharmacist (APJ) only.</p>
  }

  const { data: destructions } = await supabase
    .from('stock_destructions')
    .select('id, bap_number, bap_date, reason, witness_names, created_by, created_at')
    .order('created_at', { ascending: false })

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Pemusnahan</h1>
        <Button render={<Link href="/stock/destructions/new" />}>Pemusnahan Baru</Button>
      </div>

      {(destructions || []).length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data pemusnahan.</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nomor BAP</TableHead>
                <TableHead>Tanggal BAP</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Saksi</TableHead>
                <TableHead>Dicatat Oleh</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(destructions || []).map((d: any) => (
                <TableRow key={d.id} className="h-10">
                  <TableCell>
                    <Link href={`/stock/destructions/${d.id}`} className="text-sm text-primary hover:underline">
                      {d.bap_number}
                    </Link>
                  </TableCell>
                  <TableCell>{parseDate(d.bap_date)}</TableCell>
                  <TableCell>{d.reason}</TableCell>
                  <TableCell>{d.witness_names}</TableCell>
                  <TableCell>{d.created_by || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}