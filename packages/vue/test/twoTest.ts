import { test } from 'tap'
import { Atom } from '@alaq/atom/index'
import { ReactiveAtom } from '../src'
import { atomicModel } from 'alak/atomicModel'

class Model {
  one = 1
  two: number
}

test('reactive', (t) => {
  // const a = atomicModel({ model: Model, name: 'one' })
  // const r = ReactiveAtom(a)

  t.end()
})
