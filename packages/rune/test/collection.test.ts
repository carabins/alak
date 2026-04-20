import { describe, expect, test } from 'bun:test'
import { pick, shuffle } from '../src'

describe('pick', () => {
  test('returns an element of the array', () => {
    const arr = [1, 2, 3, 4, 5]
    for (let i = 0; i < 100; i++) {
      expect(arr).toContain(pick(arr))
    }
  })

  test('throws on empty array', () => {
    expect(() => pick([])).toThrow()
  })
})

describe('shuffle', () => {
  test('returns a permutation of the input', () => {
    const input = [1, 2, 3, 4, 5]
    const out = shuffle(input)
    expect(out).toHaveLength(input.length)
    expect([...out].sort()).toEqual([...input].sort())
  })

  test('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5]
    const snapshot = [...input]
    shuffle(input)
    expect(input).toEqual(snapshot)
  })

  test('typically produces a different order on larger arrays', () => {
    const input = Array.from({ length: 20 }, (_, i) => i)
    // At length 20 the probability of identity shuffle is 1/20! — negligible.
    const out = shuffle(input)
    const same = out.every((v, i) => v === input[i])
    expect(same).toBe(false)
  })

  test('empty input returns empty array', () => {
    expect(shuffle([])).toEqual([])
  })
})
