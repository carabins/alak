import {test, expect} from 'bun:test'
import {Nu} from '../src'
import {createState} from "@alaq/deep-state";
import {ref} from "vue";
// import { deepWatchPlugin } from '../src/deep-watch'

test('unified deep tracking - built-in functionality works with deepTracking option', () => {


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
  console.log("::",v.s)
  // v.user = 3000
  // console.log("::",v.count)
  // v.x =  "+++"
  // // v.user.name =  "+++"
  // v.items.push(1)
  // v.items[4] = 4
  //  console.log(":__________:")
  //  console.log(":::", v.items, "::::")
  //  console.log(":::", ref("sdsdd"), "::::")
})

