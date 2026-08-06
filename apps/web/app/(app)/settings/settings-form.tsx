'use client'

import { useState, useRef } from 'react'
import { saveTenantProfile, uploadLogo, removeLogo } from './actions'
import type { TenantProfile } from '../../../lib/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SettingsFormProps {
  tenant: TenantProfile
}

export function SettingsForm({ tenant }: SettingsFormProps) {
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const clientIdRef = useRef<HTMLInputElement>(null)
  const secretRef = useRef<HTMLInputElement>(null)
  const orgIdRef = useRef<HTMLInputElement>(null)

  async function handleSave(formData: FormData) {
    setSaving(true)
    setMessage(null)
    try {
      await saveTenantProfile(formData)
      setMessage({ type: 'success', text: 'Profile saved.' })
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setMessage(null)
    try {
      await uploadLogo(file)
      setMessage({ type: 'success', text: 'Logo uploaded.' })
      // Reset the input so the same file can be re-selected if needed.
      if (fileRef.current) fileRef.current.value = ''
      // Force page refresh to pick up the new URL.
      window.location.reload()
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Upload failed.' })
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleRemoveLogo() {
    setMessage(null)
    try {
      await removeLogo()
      window.location.reload()
    } catch (e: unknown) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Remove failed.' })
    }
  }

  async function handleTestConnection() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/satusehat/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientIdRef.current?.value ?? '',
          client_secret: secretRef.current?.value ?? '',
          org_id: orgIdRef.current?.value ?? '',
        }),
      })
      if (!res.ok) {
        // The route is added in a later task. A 404 means it is not live yet.
        setTestResult({
          type: 'error',
          text:
            res.status === 404
              ? 'Test connection is not available yet.'
              : `Test connection failed (${res.status}).`,
        })
        return
      }
      const data = (await res.json()) as { ok?: boolean; error?: string }
      setTestResult({
        type: data.ok ? 'success' : 'error',
        text: data.ok
          ? 'Connection OK. Token obtained.'
          : `Connection failed: ${data.error ?? 'unknown error'}`,
      })
    } catch {
      setTestResult({ type: 'error', text: 'Test connection failed. Check the server.' })
    } finally {
      setTesting(false)
    }
  }

  return (
    <form action={handleSave} className="max-w-[560px] space-y-6">
      {/* Store Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Store Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Store Name</Label>
            <Input id="name" name="name" type="text" defaultValue={tenant.name} required />
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Logo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tenant.logo_url && (
            <div className="flex items-center gap-3">
              <img
                src={tenant.logo_url}
                alt="Store logo"
                className="h-20 w-20 rounded-md border border-border object-contain"
              />
              <Button type="button" variant="destructive" size="sm" onClick={handleRemoveLogo}>
                Remove
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploadingLogo}
              className="text-[13px]"
            />
            {uploadingLogo && <span className="text-xs text-slate-500">Uploading…</span>}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" type="text" defaultValue={tenant.address ?? ''} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="text" defaultValue={tenant.phone ?? ''} />
          </div>
        </CardContent>
      </Card>

      {/* License Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">License Numbers</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sia_number">SIA Number</Label>
            <Input id="sia_number" name="sia_number" type="text" defaultValue={tenant.sia_number ?? ''} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sipa_number">SIPA Number</Label>
            <Input id="sipa_number" name="sipa_number" type="text" defaultValue={tenant.sipa_number ?? ''} />
          </div>
        </CardContent>
      </Card>

      {/* Receipt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Receipt Footer</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5">
          <Textarea
            name="receipt_footer"
            rows={3}
            defaultValue={tenant.receipt_footer ?? ''}
            placeholder="Text shown at the bottom of every receipt (optional)"
          />
          <p className="text-xs text-slate-500">Leave empty to hide the footer on receipts.</p>
        </CardContent>
      </Card>

      {/* SATUSEHAT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">SATUSEHAT</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="satusehat_client_id">Client ID</Label>
            <Input
              ref={clientIdRef}
              id="satusehat_client_id"
              name="satusehat_client_id"
              type="text"
              defaultValue={tenant.satusehat_client_id ?? ''}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="satusehat_client_secret">Client Secret</Label>
            <Input
              ref={secretRef}
              id="satusehat_client_secret"
              name="satusehat_client_secret"
              type="password"
              placeholder="Leave blank to keep the current value"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">The stored secret is never shown. Leave blank to keep it.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="satusehat_org_id">Org ID</Label>
            <Input
              ref={orgIdRef}
              id="satusehat_org_id"
              name="satusehat_org_id"
              type="text"
              defaultValue={tenant.satusehat_org_id ?? ''}
            />
          </div>
          <div className="grid gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={handleTestConnection} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            {testResult && (
              <p className={`text-xs ${testResult.type === 'success' ? 'text-green-700' : 'text-red-800'}`}>
                {testResult.text}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          className={`rounded-md px-3 py-2 text-[13px] ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}