'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: 'transparent',
        color: 'var(--primary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 14px',
        fontSize: 13,
        cursor: 'pointer',
      }}
    >
      Print (A4)
    </button>
  )
}
