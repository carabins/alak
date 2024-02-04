import { mixed, saved, tag, wrap } from '@alaq/atom/property'
import { Atom } from '@alaq/atom/index'
import { test } from 'tap'

const sqrtWrapper = (v) => v * v

class AllPropertyModel {
  a = mixed(tag.zz(), wrap(sqrtWrapper))
  b = wrap(sqrtWrapper, 2)
}

test('property', (t) => {
  const a = Atom({
    model: AllPropertyModel,
  })

  a.core.a.up((v) => {
    t.equal(v, 9)
  })
  a.core.a(3)
  t.equal(a.state.a, 9)
  t.equal(a.state.b, 4)
  a.core.b.up((v) => {
    t.equal(v, 4)
  })
  t.end()
})
