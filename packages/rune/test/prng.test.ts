import { describe, expect, test } from 'bun:test'
import { createPRNG } from '../src'

describe('createPRNG', () => {
  test('returns floats in [0, 1)', () => {
    const rng = createPRNG('test')
    for (let i = 0; i < 10; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  test('reproducibility: same seed produces identical sequence', () => {
    const a = createPRNG('test')
    const b = createPRNG('test')
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  test('different seeds produce different sequences', () => {
    const a = createPRNG('test')
    const b = createPRNG('test2')
    expect(a()).not.toBe(b())
  })

  test('numeric seed is also deterministic', () => {
    const a = createPRNG(42)
    const b = createPRNG(42)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  test('independent instances do not share state', () => {
    const a = createPRNG('x')
    const b = createPRNG('x')
    a() // advance a
    a()
    const first = a()
    // b is untouched — its third value should equal a's third value.
    b()
    b()
    expect(b()).toBe(first)
  })
})
