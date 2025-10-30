import { test, expect } from 'bun:test'
import { Atom, UnionAtom, UnionConstructor } from 'alak/index'
import vueAtom, { watchVueAtom } from '../src'

class Model {
  one = 1
  two: number

  doIt() {
    this.two = 2
  }
}

test('reactive atom', () => {
  const a = Atom({ model: Model, name: 'one' })
  const r = vueAtom(a)
  expect(r.one).toBe(1)
  a.core.one(10)
  a.core.doIt()
  expect(a.state.one).toBe(r.one)
  expect(a.state.two).toBe(2)
})

test('reactive union atom', () => {
  const a = UnionAtom({ model: Model, name: 'one' })
  const r = vueAtom(a)
  expect(r.one).toBe(1)
  a.core.one(10)
  a.core.doIt()
  expect(a.state.one).toBe(r.one)
  expect(a.state.two).toBe(2)
})

test('reactive union atom', () => {
  const { facade } = UnionConstructor({
    namespace: 'factory_test',
    models: {
      a: Model,
    },
  })
  const a = facade.atoms.a
  const r = watchVueAtom(a)
  expect(r.one).toBe(1)
  a.core.one(10)
  a.core.doIt()
  expect(a.state.one).toBe(r.one)
  expect(a.state.two).toBe(2)
})

// test("nuclon", (t)=>{
//   const n = Nucleus(3)
//   const r = watchVueNucleon(n)
//   // t.equal(n.value, r.value)
//   r.value = 5
//   // t.equal(n.value, r.value)
//   t.end()
// })
