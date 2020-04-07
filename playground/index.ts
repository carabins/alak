// import './benchmark'

import A from '../packages/facade'
import chalk from 'chalk'
import { ComputeStrategy, installComputedExtension } from '../packages/ext-computed'
// import { AC } from '../packages/core'
import { installMatchingExtension } from '../packages/ext-matching'
import { installAtomDebuggerTool } from '../packages/debug'
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
const b = A({id:2})

console.log('----')

const mm = A.from(a,b).someSafe((a,b)=>{
  console.log(a,b)
})


b.fmap(d=>{
  d.id = 3
  return d
})
