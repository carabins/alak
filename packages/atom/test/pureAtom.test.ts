import { test } from 'tap'

import { createAtom, pureAtom, pureAtoms } from '../src'

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
  const m = createAtom(model).one()
  baseTest(t, m)
})
//
test('pure atom one', async (t) => {
  const m = pureAtom(Model)
  baseTest(t, m)
})
test('pure atom many create', async (t) => {
  const mm = createAtom(Model).many()
  const m = mm.new('m1')
  baseTest(t, m)
})
test('pure atom many dif', async (t) => {
  const mm = pureAtoms(model)
  const m1 = mm.new('m1')
  const m2 = mm.new('m2')
  t.equal(m1.state(), m2.state())
  m2.state(10)
  // t.notSame(m1.state(), m2.state())
})
