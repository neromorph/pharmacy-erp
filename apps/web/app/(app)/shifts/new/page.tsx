import Link from 'next/link'
import { openShift } from '../actions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/submit-button'

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/shifts" className="mb-4 inline-block text-sm text-primary hover:underline">
          Back to Shifts
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Open Shift</h1>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Detail Shift</CardTitle>
          <CardDescription>Masukkan uang tunai di laci saat shift dimulai.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={openShift} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="opening_cash">Opening Cash *</Label>
              <Input
                id="opening_cash"
                name="opening_cash"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500">
                Cash in drawer at shift start. Numeric, non-negative.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Catatan opsional untuk shift ini"
              />
            </div>

            <SubmitButton className="w-fit">Start Shift</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
