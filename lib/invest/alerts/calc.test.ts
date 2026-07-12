import { describe, expect, it } from 'vitest'
import { drawdownFromPeak, isInCooldown, monthsBetween, percentile } from './calc'

describe('percentile', () => {
  it('interpolates linearly', () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3)
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentile([10, 20], 0.75)).toBe(17.5)
  })
  it('clamps p and handles edge sizes', () => {
    expect(percentile([5], 0.9)).toBe(5)
    expect(percentile([], 0.5)).toBeNull()
    expect(percentile([1, 2, 3], 2)).toBe(3)
  })
  it('ignores non-finite values', () => {
    expect(percentile([1, NaN, 3, Infinity], 1)).toBe(3)
  })
})

describe('drawdownFromPeak', () => {
  it('measures the current drop below the period peak', () => {
    const r = drawdownFromPeak([100, 120, 90, 96])
    expect(r?.peak).toBe(120)
    expect(r?.drawdown).toBeCloseTo(0.2, 10)
  })
  it('is zero at a fresh high', () => {
    expect(drawdownFromPeak([100, 110, 120])?.drawdown).toBe(0)
  })
  it('returns null with no usable prices', () => {
    expect(drawdownFromPeak([])).toBeNull()
    expect(drawdownFromPeak([0, -5])).toBeNull()
  })
})

describe('isInCooldown', () => {
  const now = new Date('2026-07-12T12:00:00Z')
  it('is quiet inside the window and fires after it', () => {
    expect(isInCooldown(new Date('2026-07-11T13:00:00Z'), 72, now)).toBe(true)
    expect(isInCooldown(new Date('2026-07-09T11:00:00Z'), 72, now)).toBe(false)
  })
  it('never blocks a rule that has not fired yet', () => {
    expect(isInCooldown(null, 72, now)).toBe(false)
  })
})

describe('monthsBetween', () => {
  it('approximates calendar months', () => {
    expect(
      monthsBetween(new Date('2026-01-01'), new Date('2026-05-01')),
    ).toBeCloseTo(3.94, 1)
  })
})
