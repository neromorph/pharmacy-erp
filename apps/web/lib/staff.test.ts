// apps/web/lib/staff.test.ts
import { describe, it, expect } from 'vitest'
import { STAFF_ROLES, isOwnerRole, assertCanManageStaff } from './staff'

describe('staff management guards', () => {
  it('lists the four staff roles in order', () => {
    expect(STAFF_ROLES).toEqual(['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'])
  })

  it('recognizes the OWNER role', () => {
    expect(isOwnerRole('OWNER')).toBe(true)
    expect(isOwnerRole('CASHIER')).toBe(false)
    expect(isOwnerRole(null)).toBe(false)
  })

  it('blocks non-owners from managing staff', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'CASHIER', callerId: 'a', targetId: 'b' })
    ).toThrow('Only the Owner may manage staff.')
  })

  it('blocks a user from managing themselves', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'OWNER', callerId: 'a', targetId: 'a' })
    ).toThrow('You cannot change your own role or active status.')
  })

  it('allows an owner to manage another user', () => {
    expect(() =>
      assertCanManageStaff({ callerRole: 'OWNER', callerId: 'a', targetId: 'b' })
    ).not.toThrow()
  })
})
