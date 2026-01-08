/**
 * @alaq/atom v6 - Reactive Orchestrator
 */

import { Atom as AtomFactory } from './atom'
import { AtomRepository } from './repository'
import { AtomOptions } from './types'

export type AtomDefine = <T extends new (...args: any[]) => any>(
  model: T,
  options?: AtomOptions<InstanceType<T>>
) => AtomRepository<InstanceType<T>>

export const Atom = AtomFactory as typeof AtomFactory & { define: AtomDefine }

export { kind } from './orbit'
export { ConventionsPlugin } from './plugins/conventions'
export { ComputedPlugin } from './plugins/computed'

// Types
export type { 
  AtomInstance, 
  AtomOptions, 
  AtomPlugin,
  AtomContext
} from './types'

export type { AtomRepository } from './repository'
export type { Orbit } from './orbit'
