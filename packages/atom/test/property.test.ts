import { mixed, saved, tag, wrap } from '@alaq/atom/property'
import { Atom } from '@alaq/atom/index'
import { test, expect } from 'bun:test'

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

test('property', () => {
  a.core.a.up((v) => {
    expect(v).toBe(9)
  })
  a.core.a(3)
  expect(a.state.a).toBe(9)
  expect(a.state.b).toBe(4)
  a.core.b.up((v) => {
    expect(v).toBe(4)
  })
})

test('tags', () => {
  expect(a.core.d.hasMeta('tag')).toBeTruthy()
  expect(a.core.d.getMeta('tag')).toBe('zz')
  expect(a.state.d).toBe(10)
})
