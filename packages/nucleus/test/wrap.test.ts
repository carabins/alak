import { test } from 'tap'
import { Nucleus } from '@alaq/nucleus/index'

test('wrap', (t) => {
  const n = Nucleus()
  n.setWrapper((v) => v * 2)
  n.up((v) => {
    t.equal(v, 4)
  })
  n(2)
  t.plan(1)
  t.end()
})
