import {Atom, coreAtom} from "@alaq/atom/index";
import {makeRune} from "@alaq/rune/index";
import {QuarkEventBus} from "@alaq/nucleus/bus";


const getMem = () => {
  const r = makeRune(30000000)
  return new Array(7).fill(0).map(i => r).join("+")
}

const globalBus = QuarkEventBus()

async function start() {
  const r = makeRune(3)
  console.time(r)
  const a = new Array(100000).fill(0).map(i => Atom({
    model: {
      bigString: makeRune(3000),
      _privateBigString: makeRune(3000),
    },
    bus:globalBus
  }))

  setTimeout(() => {
    a.forEach(i => {
      i.state.bigString
      i.decay()
    })
    console.timeEnd(r)
    setTimeout(start, 1000)
  }, 1000)

}

start()


// console.log(a.getValues())


// function construct(constructor, args) {
//   function F(): void {
//     constructor.apply(this, args)
//   }
//   F.prototype = constructor.prototype
//   // return new F()
// }
//
// class TWO_THREE {
//   one = 1
//   constructor(a?) {
//     // console.log({ a }, this)
//   }
// }
//
// const two = {
//   two: 2,
// }
// // const zz = Reflect.construct.apply(two, [Z, [3]])

// const z = new Z()

// const findExtends = (prototype) => {
//   const n = Object.getOwnPropertyNames(prototype)
//
//   // if (n.indexOf('__proto__') === -1) {
//   n.forEach((key) => {
//     // console.log(key, n[key].toString())
//     // console.log(n)
//     const opd = Object.getOwnPropertyDescriptor(prototype, key)
//     // console.log(opd)
//   })
//   // })
//   const np = Object.getPrototypeOf(prototype)
//
//   if (np) findExtends(np)
// }
// findExtends(TWO_THREE.prototype)
// console.log(Object.getPrototypeOf(Z).constructor)
// console.log(invoke(Object.getPrototypeOf(Z).constructor, [1]))

// console.log(Object.getPrototypeOf(Z).constructor)
// const z = new Z(1)

// const c = Object.getPrototypeOf(z).constructor
// construct(c, ['!'])
// class Dog {
//   static legs = 5;
//   constructor() {
//     console.log('woof');
//   }
// }

// progmatic use of `new` via .construct
// preload the first argument with the class we want to call;
// proxy the actual Reflect.construct method but point all gets and sets to the static Class constructor, in english: makes static available NOTE this does not mess with Reflect.construct
// const callableObject = new Proxy(Reflect.construct.bind(two, Z), {
//   get(tar, prop, val) {
//     // access static
//     return Reflect.get(Z, prop, val)
//   },
//   set(tar, prop, val) {
//     // access static
//     return Reflect.set(Z, prop, val)
//   },
//   apply(target, thisArg, argumentsList) {
//     // make the constructor work
//     console.log()
//     return target({ ...argumentsList, length: argumentsList.length })
//   },
// })
// callableObject(3) // calls constructor
// callableObject.legs; // 5
