import { AtomicModel } from 'alak/index'
import {atomicModel} from "alak/atomicModel"

class submodel extends AtomicModel {
  get thisOne() {
    return this['one'] as number
  }
  get thisId() {
    return this._.id as number
  }
}

class model extends submodel {
  one = 1

  add() {
    this.one++
  }

  getIdMethod() {
    return this._.id
  }
  oneReturnMethod() {
    return this.thisOne
  }
  constructor() {
    super()
    console.log('constructor')
  }
}
//;

const a = atomicModel({
  name: 'a',
  model,
})
//
// // progmatic use of `new` via .construct
// // preload the first argument with the class we want to call;
// // proxy the actual Reflect.construct method but point all gets and sets to the static Class constructor, in english: makes static available NOTE this does not mess with Reflect.construct
// // const callableObject = new Proxy(Reflect.construct.bind( Dog), {
// //   get(tar, prop, val) {
// //     // access static
// //     console.log('get', prop)
// //     return Reflect.get(Dog, prop, val)
// //   },
// //   set(tar, prop, val) {
// //     // access static
// //     return Reflect.set(Dog, prop, val)
// //   },
// //   apply(target, thisArg, argumentsList) {
// //     // make the constructor work
// //     console.log()
// //     return target({ ...argumentsList, length: argumentsList.length })
// //   },
// // })
// // callableObject() // calls constructor
// // callableObject.legs // 5
// //
// // console.log(a.actions.constructor.toString())
// //
