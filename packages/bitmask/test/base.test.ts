import BitInstance from '@alaq/bitmask/BitInstance'
import { test, expect } from 'bun:test'

const instance = BitInstance({
  startValue: 1,
  flags: ['ONE', 'TWO', 'THREE', 'FOUR'] as const,
  groups: {
    ONE_TWO: ['ONE', 'TWO'],
    FOUR_TWO: ['FOUR', 'TWO'],
  },
  combinations: {
    A: {
      and: ['TWO', 'ONE'],
    },
    Z: {
      and: ['ONE', 'THREE'],
      not: ['TWO'],
    },
    B: {
      or: ['ONE', 'FOUR'],
    },
  },
})

test('basic', () => {
  expect(instance.state.ONE).toBeTruthy()
  expect(instance.state.TWO).toBeFalsy()
  expect(instance.state.B).toBeTruthy()

  instance.flags.TWO.setTrue()
  expect(instance.state.TWO).toBeTruthy()

  instance.setTrue('THREE', 'FOUR')
  expect(instance.state.THREE).toBeTruthy()
  expect(instance.state.FOUR).toBeTruthy()
  const r = instance.onValueUpdate('AFFECTED_FLAGS', (v) => {
    expect(v.Z).toBeTruthy()
  })
  instance.setFalse('TWO', 'FOUR')
  expect(instance.state.FOUR).toBeFalsy()
  expect(instance.state.Z).toBeTruthy()
  instance.removeValueUpdate(r)
  instance.setTrue('TWO', 'FOUR')
  expect(instance.state.A).toBeTruthy()
})
test('combinations and', () => {
  instance.bitwise.set(0)
  let callCount = 0
  let r = instance.flags.A.onValueUpdate('ANY', () => {
    callCount++
  })
  instance.flags.A.removeValueUpdate(r)
  r = instance.flags.A.onValueUpdate('TRUE', () => {
    callCount++
  })
  instance.setTrue('ONE', 'TWO')
  instance.flags.A.removeValueUpdate(r)
  r = instance.flags.A.onValueUpdate('FALSE', () => {
    callCount++
  })
  instance.setFalse('ONE', 'TWO')
  instance.flags.A.removeValueUpdate(r)
  expect(callCount).toBeGreaterThanOrEqual(1)
})
test('combinations and not', () => {
  instance.bitwise.set(0)
  let callCount = 0
  let r = instance.flags.Z.onValueUpdate('ANY', () => {
    callCount++
  })
  instance.flags.Z.removeValueUpdate(r)
  r = instance.flags.Z.onValueUpdate('TRUE', () => {
    callCount++
  })
  instance.setTrue('ONE', 'THREE')
  instance.flags.Z.removeValueUpdate(r)
  r = instance.flags.Z.onValueUpdate('FALSE', () => {
    callCount++
  })
  instance.setTrue('ONE', 'TWO')
  instance.removeValueUpdate(r)
  expect(callCount).toBeGreaterThanOrEqual(1)
})
