import { test } from 'tap'
import { coreAtom } from '@alaq/atom/index'

const model = {
  other: 30,
} as Model

class Model {
  state: number
  other = 30
}
function baseTest(t, m) {
  t.plan(2)
  m.state.up((v) => {
    t.equal(v, 10)
  })
  m.state(10)
  t.equal(m.other.value, 30)
}

test('pure one atom: object ', async (t) => {
  const m = coreAtom(model)
  baseTest(t, m)
})
//
test('pure atom one', async (t) => {
  const m = coreAtom(Model)
  baseTest(t, m)
})
