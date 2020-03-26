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

// a.onClear(level=>{
//   console.log(level)
// })
//
// a.clearValue()
// a.clear()
// a.decay()
//
// const asyncHello = () => new Promise(fin => setTimeout(() => fin('hello'), 2500))
// const asyncWorld = () => new Promise(fin => setTimeout(() => fin('word'), 500))

// const a = A.stateless()
