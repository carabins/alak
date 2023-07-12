import { test } from 'tap'
import { bitmaskBuilder } from '../src'
const { masks, groups, stateBuilder } = bitmaskBuilder(
  ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'] as const,
  {
    BETA_DELTA: ['BETA', 'DELTA'],
    ALPHA_BETA_GAMMA: ['ALPHA', 'BETA', 'GAMMA'],
  },
)
const state = stateBuilder(groups.ALPHA_BETA_GAMMA)
test('basic', (t) => {
  state.values.once((is) => {
    t.ok(is.ALPHA_BETA_GAMMA)

    t.ok(is.ALPHA)
    t.ok(is.BETA)
    t.ok(is.GAMMA)
    t.notOk(is.DELTA)
    t.notOk(is.EPSILON)
  })
  state.setFalse('ALPHA', 'GAMMA')
  state.setTrue('EPSILON', 'DELTA')

  state.values.once((flags) => {
    t.notOk(flags.ALPHA_BETA_GAMMA)
    t.ok(flags.DELTA)
    t.notOk(flags.ALPHA)
    t.ok(flags.BETA)
    t.notOk(flags.GAMMA)
    t.ok(flags.DELTA)
    t.ok(flags.EPSILON)
  })
  state.values.clearListeners()
  // state.set(0)
  t.plan(13)
  t.end()
})

test('sync update', (t) => {
  state.values.up((flags) => {
    t.notOk(flags.ALPHA_BETA_GAMMA)
    t.ok(flags.DELTA)
    t.notOk(flags.ALPHA)
    t.notOk(flags.BETA)
    t.notOk(flags.GAMMA)
    t.notOk(flags.EPSILON)
    t.equal(masks.DELTA, state.flag.value)
  })
  state.flag.next((v) => {
    t.ok(masks.DELTA == v && v == state.mask.flags)
  })
  state.set(masks.DELTA)
  t.plan(8)
  t.end()
})
