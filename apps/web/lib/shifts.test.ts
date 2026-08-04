import { describe, expect, it } from 'vitest'
import {
  canOpenShift,
  canCloseShift,
  canForceCloseShift,
  parseOpeningCash,
} from './shifts'

describe('shift policy', () => {
  it('allows open when no shift is open', () => {
    expect(canOpenShift(null)).toBe(true)
    expect(canOpenShift('shift-123')).toBe(false)
  })

  it('allows close when a shift is open', () => {
    expect(canCloseShift('shift-123')).toBe(true)
    expect(canCloseShift(null)).toBe(false)
  })

  it('lets OWNER force-close', () => {
    expect(canForceCloseShift('OWNER')).toBe(true)
    expect(canForceCloseShift('PHARMACIST')).toBe(false)
    expect(canForceCloseShift('CASHIER')).toBe(false)
    expect(canForceCloseShift(null)).toBe(false)
  })
})

describe('parseOpeningCash', () => {
  it('rejects missing value', () => {
    const fd = new FormData()
    const result = parseOpeningCash(fd)
    expect(result.error).toBeTruthy()
  })

  it('accepts valid non-negative number', () => {
    const fd = new FormData()
    fd.set('opening_cash', '150000')
    const result = parseOpeningCash(fd)
    expect(result.error).toBeNull()
    expect(result.value).toBe(150000)
  })

  it('rejects negative number', () => {
    const fd = new FormData()
    fd.set('opening_cash', '-5000')
    const result = parseOpeningCash(fd)
    expect(result.error).toBeTruthy()
  })

  it('rejects non-numeric input', () => {
    const fd = new FormData()
    fd.set('opening_cash', 'abc')
    const result = parseOpeningCash(fd)
    expect(result.error).toBeTruthy()
  })
})