import { test } from 'tap'
import { alakModel } from 'alak/alakModel'
import AReactive from '../src/areactive'

class Model {
  one = 1
  two: number
}

test('reactive', (t) => {
  // const a = alakModel({ model: Model, name: 'one' })
  // const r = AReactive(a)
  // t.equal(r.one, 1)
  // a.core.one(10)
  // console.log('::::>', r.one)
  t.end()
})
