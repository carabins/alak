import type {INucleonPlugin, IPluginsRegistry, PluginCreateHook, PluginDecayHook, PluginChangeHook, PluginDeepChangeHandler} from './INucleonPlugin'
import {NuclearProto} from "./prototype";
import {INucleonCore} from "@alaq/nucl/INucleon";
import {IDeepStateChange} from "@alaq/deep-state/types";
import quarkProto from '@alaq/quark/prototype'

// --- Types ---

// Alias for the compiled registry, representing a "Kind" definition
export type INucleonKind = IPluginsRegistry

// Empty hooks for optimization
const noop = () => {}

// Internal storage for raw plugins per kind name (Base definitions)
const rawKindDefinitions: Record<string, INucleonPlugin[]> = {}

// Cache for compiled registries
export const kindRegistry = {} as Record<string, RegistryWithSource>

interface RegistryWithSource extends IPluginsRegistry {
  _plugins: INucleonPlugin[]
}

// --- Helper Functions ---

function compileHooks<T extends Function>(hooks: T[]): T {
  if (hooks.length === 0) return noop as unknown as T
  if (hooks.length === 1) return hooks[0]
  
  return function(this: any, ...args: any[]) {
    for (let i = 0; i < hooks.length; i++) {
      hooks[i].apply(this, args)
    }
  } as unknown as T
}

/**
 * Creates an optimized registry from a list of plugins.
 * Sorts plugins by 'order' (descending) before compilation.
 */
function createRegistry(plugins: INucleonPlugin[]): RegistryWithSource {
  // 1. Sort plugins by priority (Higher order executes first)
  const sortedPlugins = [...plugins].sort((a, b) => {
    const orderA = a.order ?? 0
    const orderB = b.order ?? 0
    return orderB - orderA 
  })

  const createHooks: PluginCreateHook[] = []
  const decayHooks: PluginDecayHook[] = []
  const beforeChangeHooks: PluginChangeHook[] = []
  const deepChangeHooks: PluginDeepChangeHandler[] = []
  
  // Base prototype: Start with a flat object that includes NuclearProto methods directly
  // We use flattening here so that the final proto object has all methods as own properties.
  // This ensures Object.setPrototypeOf works reliably on the function instance.
  const proto = { ...NuclearProto }
  let haveDeepWatch = false

  sortedPlugins.forEach(plugin => {
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
    _plugins: sortedPlugins,
    // _descriptors removed as we use setPrototypeOf
  }
}

// --- Public API ---

export function createKind(plugins: INucleonPlugin[]): INucleonKind {
  return createRegistry(plugins)
}

export function setupNuclearKinds(kinds: Record<string, INucleonPlugin[]>) {
  for (const [name, plugins] of Object.entries(kinds)) {
    if (!rawKindDefinitions[name]) {
      rawKindDefinitions[name] = []
    }
    rawKindDefinitions[name].push(...plugins)
  }
  
  for (const key in kindRegistry) {
    delete kindRegistry[key]
  }
}

export function defineKind(kind: string, ...plugins: INucleonPlugin[]): void {
  setupNuclearKinds({ [kind]: plugins })
}

export function getRegistryForKind(kindSelector: string): IPluginsRegistry {
  if (kindRegistry[kindSelector]) {
    return kindRegistry[kindSelector]
  }

  const keys = kindSelector.split(/\s+/).filter(k => k.length > 0)
  
  if (keys.length === 0) {
    const reg = createRegistry([])
    kindRegistry[kindSelector] = reg
    return reg
  }

  const allPlugins: INucleonPlugin[] = []
  
  for (const key of keys) {
    const plugins = rawKindDefinitions[key]
    if (plugins) {
      allPlugins.push(...plugins)
    }
  }

  const reg = createRegistry(allPlugins)
  kindRegistry[kindSelector] = reg
  return reg
}

export function combineKinds(...kinds: string[]): string {
  const selector = kinds.join(' ')
  getRegistryForKind(selector)
  return selector
}

export function extendRegistry(baseKind: string | INucleonKind, extraPlugins: INucleonPlugin[]): IPluginsRegistry {
  let basePlugins: INucleonPlugin[] = []

  if (typeof baseKind === 'string') {
    const reg = getRegistryForKind(baseKind) as RegistryWithSource
    basePlugins = reg._plugins || []
  } else {
    basePlugins = (baseKind as RegistryWithSource)._plugins || []
  }

  return createRegistry([...basePlugins, ...extraPlugins])
}