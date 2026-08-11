import { describe, expect, it } from 'vitest'
import { validateNewPassword } from './password'

describe('validateNewPassword', () => {
  it('accepts a valid new password', () => {
    expect(validateNewPassword('OldPass123!', 'NewPass456!', 'NewPass456!')).toBeNull()
  })

  it('rejects a missing current password', () => {
    expect(validateNewPassword('', 'NewPass456!', 'NewPass456!')).toBe(
      'Current password is required.'
    )
  })

  it('rejects a new password shorter than 8 characters', () => {
    expect(validateNewPassword('OldPass123!', 'Short1!', 'Short1!')).toBe(
      'New password must be at least 8 characters.'
    )
  })

  it('rejects mismatched confirmation', () => {
    expect(validateNewPassword('OldPass123!', 'NewPass456!', 'NewPass789!')).toBe(
      'New passwords do not match.'
    )
  })

  it('rejects a new password identical to the current one', () => {
    expect(validateNewPassword('SamePass123!', 'SamePass123!', 'SamePass123!')).toBe(
      'New password must be different from the current password.'
    )
  })
})
