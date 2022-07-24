/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { createAtom } from '@alaq/atom/index'

// import { atomicModel } from '@alaq/atom/create'

class model {
  one = 1
}

test('nucleus strategy', (t) => {
  const statelessAtom = createAtom(model, {
    nucleusStrategy: 'stateless',
  }).one()
  t.equal(statelessAtom.one.isStateless, true)
  t.equal(statelessAtom.one.value, undefined)

  const holyStateAtom = createAtom(model, {
    nucleusStrategy: 'holystate',
  }).one()
  t.equal(holyStateAtom.one.isHoly, true)
  t.equal(holyStateAtom.one.isStateless, true)
  t.end()
})
