import { test } from 'tap'
import BitWise, { binary } from '../src/BitWise'
import BitNum from '../src/BitNum'

test('operations', (t) => {
  const flags = BitNum(['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'SIX'] as const)
  const MAIN = BitWise()

  t.ok(MAIN.isNot(flags.ONE))
  MAIN.add(flags.ONE)
  MAIN.add(flags.TWO)
  MAIN.add(flags.THREE)
  MAIN.add(flags.FOUR)

  const SECOND = BitWise()
  SECOND.add(flags.ONE)
  SECOND.add(flags.TWO)
  t.ok(MAIN.is(SECOND.value))

  const f = MAIN.onValueUpdate((n) => {
    t.ok(n === MAIN.value)
  })

  MAIN.toggle(flags.THREE)
  t.ok(MAIN.isNot(flags.THREE))
  MAIN.remove(flags.FOUR)
  t.ok(MAIN.isNot(flags.FOUR))
  MAIN.removeValueUpdate(f)
  MAIN.set(0)
  // t.ok(MAIN.isNot(flags.ONE)) base.test.ts

  t.plan(7)
  t.end()
})
