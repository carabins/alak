import { alakModel } from 'alak/model'
import { test } from 'tap'

test('alak atoms', async (t) => {
  class model {
    one = 1
    two = 2
  }

  const a = alakModel({
    name: 'a',
    model,
  })
  // console.log(a.getValues())
})
