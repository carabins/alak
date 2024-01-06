import {test} from 'tap'
import {UnionFactory} from "alak/index";
import {UnionAtom} from "alak/index";
import CountModel from "./models/CountModel";


const a = UnionAtom({
  name: "a",
  model: CountModel,
})


test('stable model', async (t) => {

  t.match(a.state.count, 1)
})


test('stable atom', async (t) => {
  const union = UnionFactory({
    models: {
      s: CountModel
    },
    factories: {
      b: CountModel,
      c: CountModel
    }
  })

  const bInstance1 = union.atoms.b.get(1)
  const bInstance2 = union.atoms.b.get(2)

  bInstance2.actions.increment()
  t.match(bInstance1.state.count, 1)
  t.match(bInstance2.state.count, 2)
  t.match(union.atoms['a'].state.count, 1)
  a.core.increment()
  t.match(union.atoms['a'].state.count, 2)
  bInstance2.actions.increment()
  t.match(bInstance2.state.count, 3)



  t.end()
})


