import {test} from 'tap'
import {UnionConstructor} from "alak/index";
import {UnionAtom} from "alak/index";
import CountModel from "./models/CountModel";

const a = UnionAtom({
  name: "a",
  model: CountModel,
})

test('stable model', async (t) => {
  t.match(a.state.count, 1)
  t.match(a.state.mixedCount, 100)
  console.warn(a.known.values())
})


test('stable atom', async (t) => {
  const {facade} = UnionConstructor({
    models: {
      s: CountModel
    },
    factories: {
      b: CountModel,
      c: CountModel
    }
  })

  const bInstance1 = facade.atoms.b.get(1)
  const bInstance2 = facade.atoms.b.get(2)

  bInstance2.actions.increment()
  t.match(bInstance1.state.count, 1)
  t.match(bInstance2.state.count, 2)
  t.match(facade.atoms['a'].state.count, 1)
  a.core.increment()
  t.match(facade.atoms['a'].state.count, 2)
  bInstance2.actions.increment()
  t.match(bInstance2.state.count, 3)

  t.end()
})


