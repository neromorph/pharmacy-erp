export const statusColors: Record<string, string> = {
  DRAFT: '#64748b',
  PAID: '#10b981',
  VOID: '#ef4444',
}

export function parseDate(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString()
}