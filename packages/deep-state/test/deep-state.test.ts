import {test, expect} from 'bun:test'
import {createState} from "../src/index";

test('deep-state - createState and deepWatch work correctly', () => {


  const state = createState((a) => {
    console.log(">>>", a)
  })

  const v = state.deepWatch({
    count: 0,
    user: {
      name: 'John',
      age: 30
    },
    items: []
  })
  const s = {a:1}
  v.s = s
})

