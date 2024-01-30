import {test} from 'tap'
import N, {Nucleus, Q} from '@alaq/nucleus/index'

test('some from', (t) => {
  const a = Nucleus(1)
  const b = Nucleus()
  const f = Nucleus
    .from(a, b)
    .some((va, vb) => vb + va)
  t.equal(f.value, undefined)
  f.up(v=>{
    t.equal(v, 2)
  })
  b(1)
  t.end()
})

test('weak from', (t) => {
  t.plan(4)
  const na = Nucleus()
  const nb = Nucleus()
  const nf = Nucleus
    .from(na, nb)
    .weak((a, b) => {
      t.ok(true)
    })
  na(null)
  na(undefined)
  nb(null)
  t.end()
})
