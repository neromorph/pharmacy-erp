import { createClient } from '../../../utils/supabase/server'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function SuppliersPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Pemasok (PBF)</h1>
      {!suppliers || suppliers.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data pemasok</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>PBF</TableHead>
                <TableHead>Nomor Izin</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead className="text-right">Termin Pembayaran (hari)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s: any) => (
                <TableRow key={s.id} className="h-10">
                  <TableCell>
                    <Link href={`/suppliers/${s.id}`} className="text-primary hover:underline">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.is_pbf ? 'default' : 'secondary'}>
                      {s.is_pbf ? 'PBF' : 'Non-PBF'}
                    </Badge>
                  </TableCell>
                  <TableCell>{s.pbf_license_number || '-'}</TableCell>
                  <TableCell>{s.phone || '-'}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.payment_terms_days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
