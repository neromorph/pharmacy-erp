'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { validateNewPassword } from '@/lib/password'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AccountFormProps {
  email: string
}

export function AccountForm({ email }: AccountFormProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    const error = validateNewPassword(current, next, confirm)
    if (error) {
      setMessage({ type: 'error', text: error })
      return
    }

    const supabase = createClient()
    setBusy(true)
    try {
      // Re-authenticate with the current password before allowing a change.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (reauthError) {
        setMessage({ type: 'error', text: 'Current password is incorrect.' })
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: next })
      if (updateError) {
        setMessage({ type: 'error', text: updateError.message })
        return
      }

      // Revoke all other sessions. The current session stays active.
      await supabase.auth.signOut({ scope: 'others' })

      setCurrent('')
      setNext('')
      setConfirm('')
      setMessage({ type: 'success', text: 'Password updated. Other sessions were signed out.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ubah Kata Sandi</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">Kata Sandi Saat Ini</Label>
            <Input
              id="current-password"
              name="current-password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">Kata Sandi Baru</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-password">Ulangi Kata Sandi Baru</Label>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {message && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={
                message.type === 'error'
                  ? 'text-sm text-destructive'
                  : 'text-sm text-emerald-600'
              }
            >
              {message.text}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
