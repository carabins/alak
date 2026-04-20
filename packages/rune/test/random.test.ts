import { describe, expect, test } from 'bun:test'
import { randomBytes, randomFloat, randomInt } from '../src'

describe('randomBytes', () => {
  test('returns Uint8Array of requested length', () => {
    expect(randomBytes(32).length).toBe(32)
    expect(randomBytes(0).length).toBe(0)
    expect(randomBytes(1)).toBeInstanceOf(Uint8Array)
  })

  test('different calls produce different output', () => {
    const samples = new Set<string>()
    for (let i = 0; i < 10; i++) {
      samples.add(Buffer.from(randomBytes(32)).toString('hex'))
    }
    expect(samples.size).toBe(10)
  })

  test('rejects invalid n', () => {
    expect(() => randomBytes(-1)).toThrow()
    expect(() => randomBytes(1.5)).toThrow()
  })
})

describe('randomInt', () => {
  test('values are in [min, max)', () => {
    for (let i = 0; i < 1000; i++) {
      const v = randomInt(0, 100)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(100)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  test('distribution hits every bucket of width 10', () => {
    const buckets = new Array(10).fill(0)
    for (let i = 0; i < 1000; i++) {
      buckets[Math.floor(randomInt(0, 100) / 10)]++
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(0)
    }
  })

  test('rejects min >= max', () => {
    expect(() => randomInt(5, 5)).toThrow()
    expect(() => randomInt(10, 5)).toThrow()
  })

  test('works with negative ranges', () => {
    for (let i = 0; i < 100; i++) {
      const v = randomInt(-50, -10)
      expect(v).toBeGreaterThanOrEqual(-50)
      expect(v).toBeLessThan(-10)
    }
  })
})

describe('randomFloat', () => {
  test('values are in [0, 1) and mean is ~0.5', () => {
    let sum = 0
    for (let i = 0; i < 1000; i++) {
      const v = randomFloat()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    const mean = sum / 1000
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.05)
  })
})
