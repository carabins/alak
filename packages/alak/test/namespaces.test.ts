import { test } from 'tap'
import { UnionConstructor } from 'alak/UnionConstructor'
import CountModel from './models/CountModel'
import { UnionModel } from 'alak/index'

test('namespace edges', async (t) => {
  const u = UnionConstructor({
    namespace: 'ns.test',
    models: {
      a: CountModel,
      b: class extends UnionModel<any> {
        get count() {
          return this._.states.a.count
        }
      },
    },
  })

  t.equal(u.facade.BAtom.state['count'], 1)

  // u.facade.cores.b.aCount.up((v) => {
  //   console.warn(v)
  // })
  // u.facade.cores.a.increment()
  // console.warn(u.facade.states.a.count)
  // u.facade.cores.a.count(10)
  // console.warn(u.facade.states.a.mixedCount)
})
