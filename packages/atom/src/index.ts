/**
 * @alaq/atom - Minimal reactive state management
 *
 * Built on @alaq/quark proactive containers with computed support via Fusion
 *
 * @example
 * ```ts
 * import { Atom } from '@alaq/atom'
 *
 * class Counter {
 *   count = 0
 *   step = 1
 *
 *   increment() {
 *     this.count += this.step
 *   }
 *
 *   get doubled() {
 *     return this.count * 2
 *   }
 * }
 *
 * const counter = Atom(Counter, { name: 'counter' })
 *
 * counter.state.count = 10
 * counter.actions.increment()
 * console.log(counter.state.doubled) // 22
 * ```
 */

export { Atom } from './atom'
export { synthesis } from './markers'
export { use } from './plugin'

// Types
export type {
  AtomPlugin,
  AtomOptions,
  AtomInstance,
  ParsedModel
} from './types'
