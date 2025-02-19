import { mixed, saved, tag, wrap } from '@alaq/atom/property'
import { Atom } from '@alaq/atom/index'
import { test } from 'tap'

const sqrtWrapper = (v) => v * v
const sqrtArrayWrapper = (a) => a.map(sqrtWrapper)

class AllPropertyModel {
  a = mixed(tag.zz(), wrap(sqrtWrapper))
  b = wrap(sqrtWrapper, 2)
  //@ts-ignore
  c = wrap(sqrtArrayWrapper, tag.odd, [2]) as number[]
  d = mixed(tag.zz(), 10)
}
const a = Atom({
  model: AllPropertyModel,
})

test('property', (t) => {
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

test('tags', (t) => {
  t.ok(a.core.d.hasMeta('tag'))
  t.equal(a.core.d.getMeta('tag'), 'zz')
  t.equal(a.state.d, 10)
  t.end()
})
