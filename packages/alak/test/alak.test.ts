import {alakModel} from 'alak/model'
import {test} from 'tap'
import {UnionFacade, UnionFactory} from "alak/namespaces";

const namespace = 'defaultUnion'

class model {
  one = 1

  x10() {
    this.one = this.one * 10
  }
}

const a = alakModel({
  name: 'a',
  model,
})

test('stable model', async (t) => {
  t.match(a.state.one, 1)
})


test('stable atom', async (t) => {
  const union = UnionFactory({
    namespace: 'defaultUnion',
    singletons: {
      s: model
    },
    factories: {
      b: model,
      c: model
    }
  })

  const bInstance1 = union.atoms.b.get(1)
  const bInstance2 = union.atoms.b.get(2)
  bInstance2.actions.x10()
  t.match(bInstance1.state.one, 1)
  t.match(bInstance2.state.one, 10)
  t.match(union.atoms['a'].state.one, 1)
  a.core.x10()
  t.match(union.atoms['a'].state.one, 10)
  bInstance2.actions.x10()
  t.match(bInstance2.state.one, 100)
  t.end()
})

