/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test, expect } from 'bun:test'
import { Atom } from '@alaq/atom/index'

class model {
  one = 1
}

test('nucleus strategy', () => {
  const statelessAtom = Atom({
    model,
    nucleusStrategy: 'stateless',
  })
  expect(statelessAtom.core.one.isStateless).toBe(true)
  expect(statelessAtom.state.one).toBe(undefined)
  const holyStateAtom = Atom({
    model,
    nucleusStrategy: 'holystate',
  })
  expect(holyStateAtom.core.one.isHoly).toBe(true)
  expect(holyStateAtom.core.one.isStateless).toBe(true)
})
