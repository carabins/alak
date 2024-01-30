import { test } from 'tap'
import { UnionConstructor } from 'alak/index'
import BirdsModel from './models/BirdsModel'

test('factory test', async (t) => {
  const uc = UnionConstructor({
    // namespace: "factory_test",
    models: {
      b: BirdsModel,
    },
    // emitChanges: true
  })

  // uc.bus.addEverythingListener((event, data) => {
  //     switch (event) {
  //       case "NUCLEUS_INIT":
  //         const {tag, nucleus} = data
  //         // console.warn(event, nucleus.value)
  //         // console.warn(event, ":", data)
  //         // nucleus.up(v=>{
  //         //   console.warn({v})
  //         // })
  //     }
  //   }
  // )

  // uc.bus.addEventListener("NUCLEUS_INIT",(data)=>{
  //   console.warn(data.nucleus.value)
  // })
  console.warn(uc.facade.cores.b.mixed.value)

  // console.warn(uc.facade.atoms.b.state.mixed)
  // console.warn(uc.atoms.b.state.rune)
  // console.warn("state song", uc.atoms.b.state.song)
  // uc.cores.b.song("zz")

  t.pass()
})
