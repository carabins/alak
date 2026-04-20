import { describe, expect, test } from 'bun:test'
import { nanoid, ulid, uuidV7 } from '../src'

describe('uuidV7', () => {
  const UUID_V7_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

  test('matches canonical v7 format', () => {
    for (let i = 0; i < 50; i++) {
      expect(uuidV7()).toMatch(UUID_V7_RE)
    }
  })

  test('is time-ordered (two consecutive calls sort ascending)', () => {
    const a = uuidV7()
    // Force a ms gap so the prefix differs — strips out the random tie-breaker.
    const end = Date.now() + 2
    while (Date.now() < end) {
      /* spin */
    }
    const b = uuidV7()
    expect(b > a).toBe(true)
  })
})

describe('ulid', () => {
  const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/

  test('length 26 and Crockford alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const s = ulid()
      expect(s).toHaveLength(26)
      expect(s).toMatch(ULID_RE)
    }
  })

  test('is monotonic within the same millisecond', () => {
    let prev = ulid()
    for (let i = 0; i < 100; i++) {
      const next = ulid()
      expect(next > prev).toBe(true)
      prev = next
    }
  })
})

describe('nanoid', () => {
  test('default length 21 and default URL-safe alphabet', () => {
    const s = nanoid()
    expect(s).toHaveLength(21)
    expect(s).toMatch(/^[A-Za-z0-9_-]{21}$/)
  })

  test('custom length and alphabet', () => {
    const s = nanoid(10, 'ABC')
    expect(s).toHaveLength(10)
    expect(s).toMatch(/^[ABC]{10}$/)
  })

  test('custom alphabet with awkward size uses rejection sampling correctly', () => {
    // Alphabet length 3 produces a 2-bit mask; values 3 are rejected.
    // 1000 chars over {A,B,C} should have all three present.
    const s = nanoid(1000, 'ABC')
    expect(s).toHaveLength(1000)
    expect(s).toMatch(/^[ABC]{1000}$/)
    expect(s.includes('A')).toBe(true)
    expect(s.includes('B')).toBe(true)
    expect(s.includes('C')).toBe(true)
  })

  test('length 0 returns empty string', () => {
    expect(nanoid(0)).toBe('')
  })
})
