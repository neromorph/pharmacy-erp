import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { createPatient, updatePatient, deletePatient } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function fmtDate(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID')
}

export default async function PatientsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const canEdit = role === 'OWNER' || role === 'PHARMACIST'
  const isOwner = role === 'OWNER'

  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Pasien</h1>
        <Button render={<Link href="/" />} variant="outline" size="sm">Kembali</Button>
      </div>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Pasien Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createPatient} className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="address">Alamat</Label>
                <Input id="address" name="address" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Telepon</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="birth_date">Tanggal Lahir</Label>
                <Input id="birth_date" name="birth_date" type="date" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bpjs_number">No. Peserta BPJS</Label>
                <Input id="bpjs_number" name="bpjs_number" placeholder="cth. 0001234567890" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nik">NIK</Label>
                <Input id="nik" name="nik" placeholder="NIK 16 digit" />
              </div>
              <div className="flex items-end">
                <Button type="submit">Simpan Pasien</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!patients || patients.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data pasien</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Alamat</TableHead>
                <TableHead>Telepon</TableHead>
                <TableHead>Tanggal Lahir</TableHead>
                <TableHead>No. Peserta BPJS</TableHead>
                <TableHead>NIK</TableHead>
                {canEdit ? <TableHead></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((p: any) => (
                <TableRow key={p.id} className="h-10">
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.address || '-'}</TableCell>
                  <TableCell>{p.phone || '-'}</TableCell>
                  <TableCell>{fmtDate(p.birth_date)}</TableCell>
                  <TableCell>{p.bpjs_number || '-'}</TableCell>
                  <TableCell>{p.nik || '-'}</TableCell>
                  {canEdit ? (
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-primary">Ubah</summary>
                        <form action={updatePatient} className="grid gap-3 py-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                          <input type="hidden" name="id" value={p.id} />
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-name-${p.id}`}>Nama</Label>
                            <Input id={`edit-name-${p.id}`} name="name" required defaultValue={p.name} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-address-${p.id}`}>Alamat</Label>
                            <Input id={`edit-address-${p.id}`} name="address" defaultValue={p.address ?? ''} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-phone-${p.id}`}>Telepon</Label>
                            <Input id={`edit-phone-${p.id}`} name="phone" defaultValue={p.phone ?? ''} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-dob-${p.id}`}>Tanggal Lahir</Label>
                            <Input id={`edit-dob-${p.id}`} name="birth_date" type="date" defaultValue={p.birth_date ?? ''} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-bpjs-${p.id}`}>No. Peserta BPJS</Label>
                            <Input id={`edit-bpjs-${p.id}`} name="bpjs_number" defaultValue={p.bpjs_number ?? ''} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-nik-${p.id}`}>NIK</Label>
                            <Input id={`edit-nik-${p.id}`} name="nik" defaultValue={p.nik ?? ''} placeholder="NIK 16 digit" />
                            {p.ihs_number ? (
                              <p className="text-xs text-slate-500">IHS: {p.ihs_number}</p>
                            ) : null}
                          </div>
                          <div className="flex items-end">
                            <Button type="submit" size="sm">Simpan</Button>
                          </div>
                        </form>
                        {isOwner ? (
                          <form action={deletePatient} className="pb-2">
                            <input type="hidden" name="id" value={p.id} />
                            <Button type="submit" variant="destructive" size="sm">Hapus</Button>
                          </form>
                        ) : null}
                      </details>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}