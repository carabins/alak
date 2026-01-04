import type {INucleonPlugin, IPluginsRegistry, PluginCreateHook, PluginDecayHook, PluginChangeHook, PluginDeepChangeHandler} from './INucleonPlugin'
import {NuclearProto} from "./prototype";
import {INucleonCore} from "@alaq/nucl/INucleon";
import {IDeepStateChange} from "@alaq/deep-state/types";

// Empty hooks for optimization
const noop = () => {}

// Helper to compile an array of functions into one
function compileHooks<T extends Function>(hooks: T[]): T {
  if (hooks.length === 0) return noop as unknown as T
  if (hooks.length === 1) return hooks[0]
  
  return function(this: any, ...args: any[]) {
    for (let i = 0; i < hooks.length; i++) {
      hooks[i].apply(this, args)
    }
  } as unknown as T
}

interface RegistryWithSource extends IPluginsRegistry {
  _plugins: INucleonPlugin[]
}

export const kindRegistry = {} as Record<string, RegistryWithSource>

/**
 * Creates an optimized registry from a list of plugins
 */
function createRegistry(plugins: INucleonPlugin[]): RegistryWithSource {
  const createHooks: PluginCreateHook[] = []
  const decayHooks: PluginDecayHook[] = []
  const beforeChangeHooks: PluginChangeHook[] = []
  const deepChangeHooks: PluginDeepChangeHandler[] = []
  
  // Base prototype
  const proto = Object.create(NuclearProto)
  let haveDeepWatch = false

  plugins.forEach(plugin => {
    if (plugin.onCreate) createHooks.push(plugin.onCreate)
    if (plugin.onDecay) decayHooks.push(plugin.onDecay)
    if (plugin.onBeforeChange) beforeChangeHooks.push(plugin.onBeforeChange)
    if (plugin.onDeepChange) {
      deepChangeHooks.push(plugin.onDeepChange)
      haveDeepWatch = true
    }
    
    // Install hook runs immediately during definition
    if (plugin.onInstall) plugin.onInstall()

    if (plugin.methods) {
      Object.assign(proto, plugin.methods)
    }
    if (plugin.properties) {
      Object.defineProperties(proto, plugin.properties)
    }
  })

  // Compile hooks
  const compiledCreate = compileHooks(createHooks)
  const compiledDecay = compileHooks(decayHooks)
  const compiledBeforeChange = compileHooks(beforeChangeHooks)
  
  // Compile handleWatch
  const compiledDeepHooks = compileHooks(deepChangeHooks)
  const handleWatch = (n: INucleonCore, f: IDeepStateChange) => {
    if (haveDeepWatch) {
      compiledDeepHooks(n, f)
    }
  }

  return {
    onCreate: compiledCreate,
    onDecay: compiledDecay,
    onBeforeChange: compiledBeforeChange,
    handleWatch,
    proto,
    haveDeepWatch,
    _plugins: plugins
  }
}

/**
 * Define a named kind of Nucl with a set of plugins
 */
export function defineKind(kind: string, ...plugins: INucleonPlugin[]): void {
  kindRegistry[kind] = createRegistry(plugins)
}

/**
 * Get registry for a kind name.
 * If not found, returns (and caches) an empty default registry.
 */
export function getRegistryForKind(kind: string): IPluginsRegistry {
  let reg = kindRegistry[kind]
  if (!reg) {
    reg = createRegistry([])
    kindRegistry[kind] = reg
  }
  return reg
}

/**
 * Combine multiple kinds into a new one.
 * Returns the name of the new combined kind.
 * 
 * @example
 * const deepNucleus = combineKinds("nucleus", "deep-state")
 * const n = Nu({ kind: deepNucleus })
 */
export function combineKinds(...kinds: string[]): string {
  const sorted = kinds.sort().join('|')
  if (kindRegistry[sorted]) return sorted
  
  const allPlugins: INucleonPlugin[] = []
  
  kinds.forEach(k => {
    // Ensure kind exists (or create default)
    if (!kindRegistry[k]) {
      kindRegistry[k] = createRegistry([])
    }
    const reg = kindRegistry[k]
    if (reg._plugins) {
      allPlugins.push(...reg._plugins)
    }
  })
  
  kindRegistry[sorted] = createRegistry(allPlugins)
  return sorted
}

/**
 * Extend an existing registry (or kind) with extra plugins on the fly.
 * Used for `options.plugins`.
 * Returns a new registry (not registered in kindRegistry to avoid pollution with unique combos).
 */
export function extendRegistry(baseKind: string, extraPlugins: INucleonPlugin[]): IPluginsRegistry {
  // We can re-use combine logic but here we return registry object, not name.
  // Actually, we can just create a registry from (base plugins + extra).
  
  const baseReg = getRegistryForKind(baseKind) as RegistryWithSource
  const allPlugins = [...(baseReg._plugins || []), ...extraPlugins]
  
  return createRegistry(allPlugins)
}

// Deprecated alias removal
// export const createNuRealm = defineKind 
// export const getPluginsForRealm = getRegistryForKind