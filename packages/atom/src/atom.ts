/**
 * @alaq/atom - Core Orchestrator
 */

import { AtomInstance, AtomOptions, AtomPlugin } from './types'
import { ConventionsPlugin } from './plugins/conventions'
import { ComputedPlugin } from './plugins/computed'
import { createAtomFactory, AtomFactory } from './factory'
import { createAtomRepository, AtomRepository } from './repository'

export { createAtomFactory }

const DEFAULT_PLUGINS = [ComputedPlugin, ConventionsPlugin]
const atomicKindDefinitions = new Map<string, AtomPlugin[]>()
// Cache factory (compiler result), not repository
const factoryCache = new WeakMap<any, AtomFactory<any>>()

/**
 * Register a set of plugins as a named "Kind"
 */
export function defineAtomKind(name: string, plugins: AtomPlugin[]) {
  atomicKindDefinitions.set(name, plugins)
}

/**
 * Define an Atom Repository for a Model
 */
function define<T extends new (...args: any[]) => any>(
  model: T,
  options: AtomOptions<InstanceType<T>> = {}
): AtomRepository<InstanceType<T>> {
  let factory = factoryCache.get(model)
  if (!factory) {
    factory = createAtomFactory(model, {
      ...options,
      registry: atomicKindDefinitions,
      defaults: DEFAULT_PLUGINS
    })
    factoryCache.set(model, factory)
  }
  
  return createAtomRepository(factory, options.name || model.name || 'Atom', options)
}

export function Atom<T extends new (...args: any[]) => any>(
  model: T,
  options: AtomOptions<InstanceType<T>> = {}
): AtomInstance<InstanceType<T>> {
  // Direct creation (anonymous)
  return define(model, options).create(options.constructorArgs, options)
}

Atom.define = define
