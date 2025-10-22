import { test } from 'tap'
import {UnionConstructor, UnionModel} from 'alak/index'
import BirdsModel from './models/BirdsModel'

test('tags + EverythingListener test', async (t) => {
  const uc = UnionConstructor({
    namespace: 'addEverythingListener_test',
    models: {
      b: BirdsModel,
    },
    factories: {
      z: BirdsModel,
    },
    emitChanges: true,
  })
  // console.warn('::', uc.facade.BState.song)

  uc.bus.addEverythingListener((event, data) => {
    switch (event) {
      case 'NUCLEUS_INIT':
        switch (data.id) {
          case 'b.mixed':
            t.ok(data.metaMap.get('tag') == 'ok')
            t.ok(data.value == 'mixedValue')
            break
          case 'b.song':
            t.ok(data.metaMap.get('tag') == 'wow')
            t.ok(data.value == 'la-la-la')
            break
        }
    }
  })

  uc.facade.states.b.mixed
  uc.facade.states.b.song

  t.end()
})
