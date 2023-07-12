import { test } from 'tap'
import { bitmaskBuilder } from '../src'

// t.notOk(state.nucleon.value.ALPHA)

test('toogle', (t) => {
  const { masks, groups, stateBuilder } = bitmaskBuilder(
    ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'] as const,
    {
      BETA_DELTA: ['BETA', 'DELTA'],
      ALPHA_BETA_GAMMA: ['ALPHA', 'BETA', 'GAMMA'],
    },
  )
  const state = stateBuilder(0)
  t.notOk(state.values.value.ALPHA)
  state.changes((k, v) => {
    switch (k) {
      // case 'BETA_DELTA':
      //   t.notOk(v)
      //   break
      // case 'ALPHA_BETA_GAMMA':
      //   t.notOk(v)
      //   break
      case 'ALPHA':
        t.ok(v)
        break
    }
  })
  state.toggle('ALPHA')
  t.ok(state.values.value.ALPHA)
  t.plan(3)
  t.end()
})
