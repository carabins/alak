/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { createAtom } from '@alaq/atom/index'
import { atomicNode } from '@alaq/molecule/atomicNode'

abstract class Animal {
  abstract dispatchEvent(name: string, data?: any): void
}
class model {
  one = 1

  two: number

  addOne() {
    // this.dispatchEvent('s')
    this.one++
  }

  onOneUp(v) {
    this.two = v
  }
  onNewEventListener(v) {
    this.one = v
  }
}

test('', (t) => {
  const a = atomicNode({
    model,
  })

  a.actions.addOne()
  t.equal(a.state.two, 2)
  a.emitEvent('NEW_EVENT', 100)
  t.equal(a.state.one, 100)

  t.end()
})
