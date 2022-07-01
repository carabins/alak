import { test } from 'tap'

import Molecule, { manyMolecules, oneMolecule } from '../src'

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

test('class one', async (t) => {
  const m = Molecule(Model).one()
  baseTest(t, m)
})

test('object one', async (t) => {
  const m = Molecule(model).one()
  baseTest(t, m)
})

test('one', async (t) => {
  const m = oneMolecule(Model)
  baseTest(t, m)
})
test('many create', async (t) => {
  const mm = Molecule(Model).many()
  const m = mm.new('m1')
  baseTest(t, m)
})
test('many dif', async (t) => {
  const mm = manyMolecules(model)
  const m1 = mm.new('m1')
  const m2 = mm.new('m2')
  t.equal(m1.state(), m2.state())
  m2.state(10)
  // t.notSame(m1.state(), m2.state())
})
