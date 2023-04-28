import { atomicModel } from 'alak/atomicModel'
import { test } from 'tap'

test('alak atoms', async (t) => {
  class model {
    one = 1
    two = 2
  }

  const a = atomicModel({
    name: 'a',
    model,
  })
  console.log(a.getValues())
})
