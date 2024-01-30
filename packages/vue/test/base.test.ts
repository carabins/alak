import { test } from 'tap'
import { Atom, UnionAtom, UnionConstructor } from 'alak/index'
import vueAtom, { watchVueAtom } from '../src'

class Model {
  one = 1
  two: number

  doIt() {
    this.two = 2
  }
}

test('reactive atom', (t) => {
  const a = Atom({ model: Model, name: 'one' })
  const r = vueAtom(a)
  t.equal(r.one, 1)
  a.core.one(10)
  a.core.doIt()
  t.equal(a.state.one, r.one)
  t.equal(a.state.two, 2)
  t.end()
})

test('reactive union atom', (t) => {
  const a = UnionAtom({ model: Model, name: 'one' })
  const r = vueAtom(a)
  t.equal(r.one, 1)
  a.core.one(10)
  a.core.doIt()
  t.equal(a.state.one, r.one)
  t.equal(a.state.two, 2)
  t.end()
})

test('reactive union atom', (t) => {
  const { facade } = UnionConstructor({
    namespace: 'factory_test',
    models: {
      a: Model,
    },
  })
  const a = facade.atoms.a
  const r = watchVueAtom(a)
  t.equal(r.one, 1)
  a.core.one(10)
  a.core.doIt()
  t.equal(a.state.one, r.one)
  t.equal(a.state.two, 2)
  t.end()
})

// test("nuclon", (t)=>{
//   const n = Nucleus(3)
//   const r = watchVueNucleon(n)
//   // t.equal(n.value, r.value)
//   r.value = 5
//   // t.equal(n.value, r.value)
//   t.end()
// })
