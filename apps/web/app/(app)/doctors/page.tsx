import Link from 'next/link'
import { createClient } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { createDoctor, updateDoctor, deleteDoctor } from './actions'
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

export default async function DoctorsPage() {
  const supabase = await createClient()
  const role = await getUserRole(supabase)
  const isOwner = role === 'OWNER'

  const { data: doctors } = await supabase
    .from('doctors')
    .select('*')
    .order('name', { ascending: true })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Dokter</h1>
        <Button render={<Link href="/" />} variant="outline" size="sm">Kembali</Button>
      </div>

      {isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Dokter Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createDoctor} className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Nama</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sip_number">Nomor SIP</Label>
                <Input id="sip_number" name="sip_number" placeholder="SIP.02.xxxx" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Telepon</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="flex items-end">
                <Button type="submit">Simpan Dokter</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {!doctors || doctors.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data dokter</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Nomor SIP</TableHead>
                <TableHead>Telepon</TableHead>
                {isOwner ? <TableHead></TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((d: any) => (
                <TableRow key={d.id} className="h-10">
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.sip_number || '-'}</TableCell>
                  <TableCell>{d.phone || '-'}</TableCell>
                  {isOwner ? (
                    <TableCell>
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-primary">Ubah</summary>
                        <form action={updateDoctor} className="grid gap-3 py-3 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
                          <input type="hidden" name="id" value={d.id} />
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-name-${d.id}`}>Nama</Label>
                            <Input id={`edit-name-${d.id}`} name="name" required defaultValue={d.name} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-sip-${d.id}`}>Nomor SIP</Label>
                            <Input id={`edit-sip-${d.id}`} name="sip_number" defaultValue={d.sip_number ?? ''} />
                          </div>
                          <div className="grid gap-1.5">
                            <Label htmlFor={`edit-phone-${d.id}`}>Telepon</Label>
                            <Input id={`edit-phone-${d.id}`} name="phone" defaultValue={d.phone ?? ''} />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button type="submit" size="sm">Simpan</Button>
                          </div>
                        </form>
                        <form action={deleteDoctor} className="pb-2">
                          <input type="hidden" name="id" value={d.id} />
                          <Button type="submit" variant="destructive" size="sm">Hapus</Button>
                        </form>
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
