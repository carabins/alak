// const makeArray = (size) => [...Array(size)].map(() => size);
//
// const small =  makeArray(1000000);
// const medium = makeArray(10000000);
// const large =  makeArray(100000000);
//
// const solution1 = arr => {
//   console.time('Array.includes');
//   arr.includes(arr.length - 1)
//   console.timeEnd('Array.includes');
// }
//
// const solution2 = arr => {
//   const set = new Set(arr)
//   console.time('Set.has');
//   set.has(arr.length-1)
//   console.timeEnd('Set.has');
// }
//
// const solution3 = arr => {
//   const o = {}
//   arr.forEach(i=>{
//     o[i] = true
//   })
//   console.time('Object');
//   o[arr.length-1]
//   console.timeEnd('Object');
// }
//
//
// console.log('** Testing small array:');
// solution1(small);
// solution2(small);
// solution3(small);
// console.log('** Testing medium array:');
// solution1(medium);
// solution2(medium);
// solution3(medium);
// console.log('** Testing large array:');
// solution1(large);
// solution2(large);
// solution3(large);

import { Atom, coreAtom } from '@alaq/atom/index'
import { makeRune } from '@alaq/rune/index'
import { UnionAtom, UnionModel } from 'alak/index'

const getMem = () => {
  const r = makeRune(30000000)
  return new Array(7)
    .fill(0)
    .map((i) => r)
    .join('+')
}

async function start() {
  const r = makeRune(3)
  console.time(r)
  const a = new Array(10000).fill(0).map((i) =>
    UnionAtom({
      name: makeRune(24),
      model: {
        bigString: makeRune(3000),
        _privateBigString: makeRune(3000),
      },
      startup: 'immediately',
      // disableSpringModel:true,
      // globalBus:true
    }),
  )
  // console.log("created", process.memoryUsage())
  setTimeout(() => {
    a.forEach((i) => {
      i.decay()
    })
    // console.log("cleared", process.memoryUsage())
    console.timeEnd(r)
    setTimeout(start, 1000)
  }, 1000)
}

start()

// // console.log(a.getValues())
//
//
// // function construct(constructor, args) {
// //   function F(): void {
// //     constructor.apply(this, args)
// //   }
// //   F.prototype = constructor.prototype
// //   // return new F()
// // }
// //
// // class TWO_THREE {
// //   one = 1
// //   constructor(a?) {
// //     // console.log({ a }, this)
// //   }
// // }
// //
// // const two = {
// //   two: 2,
// // }
// // // const zz = Reflect.construct.apply(two, [Z, [3]])
//
// // const z = new Z()
//
// // const findExtends = (prototype) => {
// //   const n = Object.getOwnPropertyNames(prototype)
// //
// //   // if (n.indexOf('__proto__') === -1) {
// //   n.forEach((key) => {
// //     // console.log(key, n[key].toString())
// //     // console.log(n)
// //     const opd = Object.getOwnPropertyDescriptor(prototype, key)
// //     // console.log(opd)
// //   })
// //   // })
// //   const np = Object.getPrototypeOf(prototype)
// //
// //   if (np) findExtends(np)
// // }
// // findExtends(TWO_THREE.prototype)
// // console.log(Object.getPrototypeOf(Z).constructor)
// // console.log(invoke(Object.getPrototypeOf(Z).constructor, [1]))
//
// // console.log(Object.getPrototypeOf(Z).constructor)
// // const z = new Z(1)
//
// // const c = Object.getPrototypeOf(z).constructor
// // construct(c, ['!'])
// // class Dog {
// //   static legs = 5;
// //   constructor() {
// //     console.log('woof');
// //   }
// // }
//
// // progmatic use of `new` via .construct
// // preload the first argument with the class we want to call;
// // proxy the actual Reflect.construct method but point all gets and sets to the static Class constructor, in english: makes static available NOTE this does not mess with Reflect.construct
// // const callableObject = new Proxy(Reflect.construct.bind(two, Z), {
// //   get(tar, prop, val) {
// //     // access static
// //     return Reflect.get(Z, prop, val)
// //   },
// //   set(tar, prop, val) {
// //     // access static
// //     return Reflect.set(Z, prop, val)
// //   },
// //   apply(target, thisArg, argumentsList) {
// //     // make the constructor work
// //     console.log()
// //     return target({ ...argumentsList, length: argumentsList.length })
// //   },
// // })
// // callableObject(3) // calls constructor
// // callableObject.legs; // 5
