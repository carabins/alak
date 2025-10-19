import { test } from 'tap'
import { UnionConstructor } from 'alak/index'
import BirdsModel from './models/BirdsModel'

test('factory test', async (t) => {
  const uc = UnionConstructor({
    namespace: 'factory_test',
  })

  t.pass()
})
