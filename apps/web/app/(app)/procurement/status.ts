export const statusColors: Record<string, string> = {
  DRAFT: '#64748b',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#0d9488',
  RECEIVED: '#10b981',
  CANCELLED: '#ef4444',
}

export function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}