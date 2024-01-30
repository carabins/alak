import { test } from 'tap'
import { UnionConstructor } from 'alak/UnionConstructor'
import CountModel from './models/CountModel'
import { UnionModel } from 'alak/index'

test('namespace edges', async (t) => {
  // const u = UnionConstructor({
  //   namespace: 'ns.test',
  //   models: {
  //     a: CountModel,
  //     b: class extends UnionModel<any> {
  //       get aCount() {
  //         return this._.states.a.count
  //       }
  //     },
  //   },
  // })
  //
  // console.warn(u.facade.states.b.aCount)
  // u.facade.cores.b.aCount.up((v) => {
  //   console.warn(v)
  // })
  // u.facade.cores.a.increment()
  // console.warn(u.facade.states.a.count)
  // u.facade.cores.a.count(10)
  // console.warn(u.facade.states.a.mixedCount)
})
