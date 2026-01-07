import {createNuRealm, Nu} from "@alaq/nucl";


// console.log(n.value)
import {expect, it, test} from 'bun:test'
import {fusion} from "@alaq/nucl/fusion";

it('only one', () => {
  expect.assertions(1)
  const n = Nu()
  n.up(v => {
    expect(v.ok).toEqual(1)
  })

  n({ok: 1})
})


// it('next', () => {
//
//   const n = Nu({
//     value: {ok: {
//       ok: 1
//       }},
//     deepWatch: true
//   })
//   n.up(v => {
//     // expect(v.ok).toEqual(1)
//     console.log(":::::", v)
//   })
//   // n.value.ok = 3
//
// })
