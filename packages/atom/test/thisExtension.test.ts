/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { test, expect } from 'bun:test'
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

test('', () => {
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
  expect(a.state.v).toBe('Z')
})
