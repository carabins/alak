import { test, expect } from 'bun:test'
import BitWise, { binary } from '../src/BitWise'
import BitNum from '../src/BitNum'

test('operations', () => {
  const flags = BitNum(['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'SIX'] as const)
  const MAIN = BitWise()

  expect(MAIN.isNot(flags.ONE)).toBeTruthy()
  MAIN.add(flags.ONE)
  MAIN.add(flags.TWO)
  MAIN.add(flags.THREE)
  MAIN.add(flags.FOUR)

  const SECOND = BitWise()
  SECOND.add(flags.ONE)
  SECOND.add(flags.TWO)
  expect(MAIN.is(SECOND.value)).toBeTruthy()

  let updateCount = 0
  const f = MAIN.onValueUpdate((n) => {
    expect(n === MAIN.value).toBeTruthy()
    updateCount++
  })

  MAIN.toggle(flags.THREE)
  expect(MAIN.isNot(flags.THREE)).toBeTruthy()
  MAIN.remove(flags.FOUR)
  expect(MAIN.isNot(flags.FOUR)).toBeTruthy()
  MAIN.removeValueUpdate(f)
  MAIN.set(0)
  // expect(MAIN.isNot(flags.ONE)).toBeTruthy()

  expect(updateCount).toBeGreaterThanOrEqual(1)
})
