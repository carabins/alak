/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test } from 'tap'
import { Atom } from '@alaq/atom/index'

class model {
  v: string

  defineZtoV() {
    this.v = this['z']
  }

  constructor(a) {
    // console.log(a)
  }
}

test('', (t) => {
  const a = Atom({
    model,
    thisExtension: new Proxy(
      {},
      {
        get(o, key: string) {
          if (key === 'z') {
            return 'Z'
          }
          return undefined
        },
      },
    ),
  })

  a.actions.defineZtoV()
  t.equal(a.state.v, 'Z')
  t.end()
})
