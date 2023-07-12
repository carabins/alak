import { test } from 'tap'
import { alakModel } from 'alak/model'
import vueAtom, { watchVueAtom } from '../src'

class Model {
  one = 1
  two: number
  doIt() {
    this.two = 2
  }
}

test('reactive', (t) => {
  const a = alakModel({ model: Model, name: 'one' })
  const r = vueAtom(a)
  t.equal(r.one, 1)
  a.core.one(10)
  a.core.doIt()
  t.equal(a.state.one, r.one)
  t.equal(a.state.two, 2)
  t.end()
})
