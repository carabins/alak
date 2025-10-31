/**
 * @alaq/atom - Core Atom constructor
 */

import { Qu } from '@alaq/quark'
import { quantumBus } from '@alaq/quark/quantum-bus'
import { NeoFusion } from '@alaq/nucl/fusion'
import type { AtomOptions, AtomInstance } from './types'
import { parseModel, sortGettersByLevel } from './parse'
import { getPlugins } from './plugin'

/**
 * Create reactive atom from model
 *
 * @example
 * ```ts
 * class User {
 *   name = ''
 *   age = 0
 *
 *   greet() {
 *     return `Hello, ${this.name}!`
 *   }
 *
 *   get isAdult() {
 *     return this.age >= 18
 *   }
 * }
 *
 * const user = Atom(User, { name: 'user', realm: 'app' })
 *
 * user.state.name = 'John'
 * user.state.age = 25
 * user.actions.greet() // 'Hello, John!'
 * user.state.isAdult // true
 * ```
 */
export function Atom<T = any>(
  model: T | (new (...args: any[]) => T),
  options: AtomOptions = {}
): AtomInstance<T> {
  const container = options.container || Qu
  const baseRealm = options.realm ?? '+'
  const atomName = options.name ?? ''
  const fullRealm = atomName ? `${baseRealm}.${atomName}` : baseRealm
  const constructorArgs = options.constructorArgs || []

  // Get registered plugins
  const plugins = getPlugins()

  // Parse model (this will call constructor with args to get field defaults)
  const parsed = parseModel(model, plugins, constructorArgs)

  // Create event bus
  const bus = options.bus ?? quantumBus.getRealm(fullRealm)

  // Internal state
  const internal = {
    realm: fullRealm,
    containers: {} as Record<string, any>,
    computed: {} as Record<string, any>,
    model,
    initialized: false
  }

  // Lazy container creator
  function getContainer(key: string) {
    // Emit ATOM_INIT on first access
    if (!internal.initialized) {
      internal.initialized = true
      bus.emit('ATOM_INIT', { realm: fullRealm })
    }

    if (internal.containers[key]) {
      return internal.containers[key]
    }

    // Create container
    const value = parsed.properties[key]
    const quarkId = `${fullRealm}.${key}`

    const quark = container({
      value,
      id: quarkId,
      realm: fullRealm
    })

    // Call plugin hooks for marked properties
    const markers = parsed.markedProperties[key]
    if (markers && markers.length > 0) {
      plugins.forEach(plugin => {
        if (plugin.onQuarkProperty) {
          plugin.onQuarkProperty({
            atom: atomInstance,
            quark,
            key,
            markers
          })
        }
      })
    }

    // Optional NUCLEUS_CHANGE events
    if (options.emitChanges) {
      quark.up((val: any) => {
        bus.emit('NUCLEUS_CHANGE', { key, value: val, realm: fullRealm })
      })
    }

    internal.containers[key] = quark
    return quark
  }

  // Core proxy - direct quark access
  const core = new Proxy({}, {
    get(_, key: string) {
      // Check computed first
      if (internal.computed[key]) {
        return internal.computed[key]
      }
      return getContainer(key)
    }
  })

  // State proxy - getter/setter for values
  const state = new Proxy({} as T, {
    get(_, key: string) {
      // Check computed
      if (internal.computed[key]) {
        return internal.computed[key].value
      }

      // Check regular properties
      if (key in parsed.properties) {
        return getContainer(key).value
      }

      // Check getters (shouldn't happen if computed setup correctly)
      return undefined
    },

    set(_, key: string, value) {
      getContainer(key)(value)
      return true
    }
  })

  // Setup computed (getters) by levels
  const propertyKeys = Object.keys(parsed.properties)
  const getterLevels = sortGettersByLevel(parsed.getters, propertyKeys)

  getterLevels.forEach(level => {
    level.forEach(({ key, getter, deps }) => {
      // Get source quarks/fusions
      const sources = deps.map(dep => {
        // Check if dependency is computed
        if (internal.computed[dep]) {
          return internal.computed[dep]
        }
        // Otherwise it's a property
        return getContainer(dep)
      })

      // Create Fusion with any strategy (always recompute on changes)
      // Using 'any' instead of 'alive' because getters should work with falsy values (0, '', false)
      if (sources.length > 0) {
        internal.computed[key] = NeoFusion(...sources).any(() => {
          return getter.call(state)
        })
      } else {
        // No dependencies - create wrapper object with value getter
        // This maintains consistent API without reactive updates
        internal.computed[key] = {
          get value() {
            return getter.call(state)
          },
          up() {}, // stub
          down() {}, // stub
          decay() {} // stub
        }
      }
    })
  })

  // Actions - methods bound to state
  const actions: Record<string, Function> = {}
  Object.entries(parsed.methods).forEach(([key, method]) => {
    actions[key] = function(...args: any[]) {
      return method.apply(state, args)
    }
  })

  // Create atom instance
  const atomInstance: AtomInstance<T> = {
    core,
    state,
    actions,
    bus,
    decay,
    _internal: internal
  }

  // Call plugin onCreate hooks
  plugins.forEach(plugin => {
    if (plugin.onCreate) {
      plugin.onCreate(atomInstance, parsed.markedProperties)
    }
  })

  // Call constructor if model is a class
  // NOTE: Constructor already called in parseModel() to get field defaults
  // Here we call it again with state proxy to allow initialization logic
  if (typeof model === 'function') {
    const constructor = model.prototype.constructor

    if (constructor && constructor !== Object) {
      try {
        // Call constructor with state as this context
        constructor.call(state, ...constructorArgs)
      } catch (e) {
        // Skip if constructor requires 'new' keyword
        // Properties already initialized from parseModel
      }
    }
  }

  // Decay method
  function decay() {
    // Plugin decay hooks
    plugins.forEach(plugin => {
      if (plugin.onDecay) {
        plugin.onDecay(atomInstance)
      }
    })

    // Decay all containers
    Object.values(internal.containers).forEach(c => c.decay?.())

    // Decay all computed
    Object.values(internal.computed).forEach(c => c.decay?.())

    // Clear bus if it's ours (not external)
    if (!options.bus) {
      // quantumBus manages realm lifecycle
    }
  }

  return atomInstance
}
