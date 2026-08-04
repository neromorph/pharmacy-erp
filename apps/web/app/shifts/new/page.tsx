import Link from 'next/link'
import { openShift } from '../actions'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 4, color: 'var(--text-secondary)' }

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const error = params.error

  return (
    <section style={{ maxWidth: 480 }}>
      <Link href="/shifts" style={{ color: 'var(--primary)', display: 'inline-block', marginBottom: 16 }}>
        Back to Shifts
      </Link>
      <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Open Shift</h1>

      {error && (
        <p style={{ background: '#fef2f2', color: '#ef4444', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          {error}
        </p>
      )}

      <form
        action={openShift}
        style={{
          background: 'var(--card)',
          padding: 16,
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Opening Cash *</label>
          <input
            name="opening_cash"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            style={inputStyle}
          />
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-secondary)' }}>
            Cash in drawer at shift start. Numeric, non-negative.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            name="notes"
            rows={3}
            placeholder="Optional notes for this shift"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          style={{
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Start Shift
        </button>
      </form>
    </section>
  )
}