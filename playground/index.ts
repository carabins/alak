// import './benchmark'

import A from '../packages/facade'
import chalk from 'chalk'
import { ComputeStrategy, installComputedExtension } from '../packages/ext-computed'
// import { AC } from '../packages/core'
import { installMatchingExtension } from '../packages/ext-matching'
import { installAtomDebuggerTool } from '../packages/debug'
import { constants } from 'crypto'

// const inAwaiting = atom =>
//   typeof atom().then === 'function'
//     ? console.log(chalk.green('async'))
//     : console.log(chalk.red('sync'))
//
// installComputedExtension()
// installMatchingExtension()
// //
declare module '../packages/facade' {
  interface IAtom<T> {
    match(...pattern: any[]): IAtom<T>

    from<A extends IAtom<any>[]>(...a: A): ComputeStrategy<T, A>
  }
}

const a = A(1)
const b = A({ id: 2 })
const c = A()

console.log('play')
c.from(a, b).strong((v, vv) => {
  return { v, vv }
})

c.decay()

console.log(a(2))
// console.log(c())

// A.from(c, a).strong( (v,vv)=>{
//   console.log(v, vv)
//   return 0
// })

// const mm = A.from(a,b).strong((a,b)=>{
//   console.log("::", a,b)
// })
// // mm()
//
// // a(2)
//
// b.fmap(d=>{
//   d.id = 3
//   return d
// })

// const a = A.stateless().setGetter(() => {
//   // aGetter()
//   return Math.random()
// })
// const b = A.setOnceGet(() => {
//   // bOnceGetter()
//   return '-'
// })
// const z = A(0)
// const c = A.from(z, a, b).strong((...v) => v.toString())
// c.up(v=>{
//   console.log(":::", v)
// })
// c()
// c()
// z(1)
// z(1)

// const aGetter = jest.fn()
// const bOnceGetter = jest.fn()
// const a = A.stateless().setGetter(() => {
//   aGetter()
//   return Math.random()
// })
// const b = A.setOnceGet(() => {
//   bOnceGetter()
//   return '-'
// })
// const z = A(0)
// const c = A.from(a, b, z).strongSafe((...v) => v.toString())
// const cUpReceiver = jest.fn()
// c.up(cUpReceiver)
// c()
// c()
// z(1)
// z(1)
// z(1)

// c()
// c()
// z.up(v=>{
//     console.log("x",v )
//   }
// )
// z.safe(true)
// z(1)
// z(2)
// z(0)
// z(0)
// c()
// z(2)
// console.log(Math.random())
