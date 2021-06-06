/// <reference path="../packages/alak/index.d.ts" />
/// <reference path="../packages/alak/IAtom.d.ts" />
import { A, installAtomExtension } from '../packages/alak/src'
///
import debug from '../packages/alak/src/debug'
// import avue from '../packages/vue/src'


const a = A() as IAtom<any>
const b = A()
const c = A()

a.up(v => {
  console.log('a updated', v)
})


a()

a.emit()

a.parentFor(b)

// b.channel(a)
// b("b1")
// c.channel(a)
// b("b2")
// c("c2")
// b("b3")


// console.log("{avue}")

// installAtomExtension(avue)

// debug.activate('localhost:10946')

// const startValue = 'startValue'
// const finalValue = 'finalValue'
// const beStart = (v) => console.log(v == startValue)
// const beFinal = (v) => console.log(v == finalValue)
// const neverBe = (v) => console.log('neverBe')
// let a = A({
//   a1: 'ab',
//   a2: 'ac',
// })
//
// let c = a.boxMap((v) => 'c::' + v)
// let d = a.boxToList()
//
// c.up((v) => console.log(v))
//
// let z = A()
// z.up((v) => console.log('z', v))
// z.tuneTo(c)
// a.boxAssign({ a3: 'aa' })
// z.tuneTo(d)
// a.boxAssign([{ id: 'a4', v: 'aa' }])
//
// let ar = A([1, 2, 3, 4, 5])
// let ar2 = A([
//   { id: 1, v: 'a' },
//   { id: 2, v: 'v' },
// ])
//
// ar.up((v) => console.log('ar:', v))
// ar.listAdd(6)
//
// let o2 = ar2.listToBox()
// console.log(o2.value)
