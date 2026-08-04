'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      style={{
        background: 'var(--primary)',
        color: '#fff',
        padding: '8px 20px',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      Print Struk
    </button>
  )
}