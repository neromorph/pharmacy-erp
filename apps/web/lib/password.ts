export const MIN_PASSWORD_LENGTH = 8

/**
 * Validate a password change request.
 * Returns an error message, or null when the request is valid.
 */
export function validateNewPassword(
  current: string,
  next: string,
  confirm: string
): string | null {
  if (!current) return 'Current password is required.'
  if (!next) return 'New password is required.'
  if (next.length < MIN_PASSWORD_LENGTH) {
    return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  if (next !== confirm) return 'New passwords do not match.'
  if (next === current) return 'New password must be different from the current password.'
  return null
}
