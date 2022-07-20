/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { atomicNodes } from '@alaq/molecule/atomicNode'

class M {
  one = 1
  add() {}
  get o() {
    return { id: this.id }
  }
}

const m1 = atomicNodes({
  model: M,
})
const m2 = atomicNodes({
  model: M,
})
