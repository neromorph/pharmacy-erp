'use client'

import { useState, useRef } from 'react'
import { saveTenantProfile, uploadLogo, removeLogo } from './actions'
import type { TenantProfile } from '../../lib/settings'

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text-secondary)',
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: 'var(--card)',
  color: 'var(--text-primary)',
  width: '100%',
  boxSizing: 'border-box',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
}

interface SettingsFormProps {
  tenant: TenantProfile
}

export function SettingsForm({ tenant }: SettingsFormProps) {
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <form action={handleSave} style={{ maxWidth: 560 }}>
      {/* Store Identity */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Store Identity</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="name">Store Name</label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={tenant.name}
              required
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Logo</h2>
        {tenant.logo_url && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={tenant.logo_url}
              alt="Store logo"
              style={{ width: 80, height: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6 }}
            />
            <button
              type="button"
              onClick={handleRemoveLogo}
              style={{ marginLeft: 12, fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Remove
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploadingLogo}
          style={{ fontSize: 13 }}
        />
        {uploadingLogo && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Uploading…</span>}
      </div>

      {/* Contact */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Contact</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="address">Address</label>
            <input id="address" name="address" type="text" defaultValue={tenant.address ?? ''} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="text" defaultValue={tenant.phone ?? ''} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* License Numbers */}
      <div style={sectionStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>License Numbers</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="sia_number">SIA Number</label>
            <input id="sia_number" name="sia_number" type="text" defaultValue={tenant.sia_number ?? ''} style={inputStyle} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="sipa_number">SIPA Number</label>
            <input id="sipa_number" name="sipa_number" type="text" defaultValue={tenant.sipa_number ?? ''} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Receipt Footer</h2>
        <textarea
          name="receipt_footer"
          rows={3}
          defaultValue={tenant.receipt_footer ?? ''}
          placeholder="Text shown at the bottom of every receipt (optional)"
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          Leave empty to hide the footer on receipts.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 6,
            marginBottom: 16,
            background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            fontSize: 13,
          }}
        >
          {message.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{
          padding: '8px 20px',
          background: 'var(--primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}