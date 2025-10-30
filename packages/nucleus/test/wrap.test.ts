import { test, expect } from 'bun:test'
import { Nucleus } from '@alaq/nucleus/index'

test('wrap', () => {
  const n = Nucleus()
  n.setWrapper((v) => v * 2)
  n.up((v) => {
    expect(v).toBe(4)
  })
  n(2)
})
