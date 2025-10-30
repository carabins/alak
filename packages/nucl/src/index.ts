/**
 * Nucl - Enhanced Quark with plugin system
 * @module @alaq/nucl
 */

import { createQu } from '@alaq/quark'
import type { QuOptions } from '@alaq/quark'

/**
 * Plugin definition
 */
export interface NuclPlugin {
  /** Unique plugin name */
  name: string

  /** Methods to add to Nucl prototype */
  methods?: Record<string, Function>

  /** Properties (getters/setters) to add to Nucl prototype */
  properties?: Record<string, PropertyDescriptor>

  /** Called when plugin is installed */
  onInstall?: () => void

  /** Called when Nucl is created (if plugin installed) */
  onCreate?: (nucl: any) => void

  /** Called when Nucl.decay() is called */
  onDecay?: (nucl: any) => void
}

/**
 * Plugin registry
 */
const registry = {
  plugins: new Map<string, NuclPlugin>(),
  createHooks: [] as Array<(nucl: any) => void>,
  decayHooks: [] as Array<(nucl: any) => void>
}

/**
 * Install plugin globally
 */
export function use(plugin: NuclPlugin): void {
  if (registry.plugins.has(plugin.name)) {
    return // Already installed
  }

  registry.plugins.set(plugin.name, plugin)

  // Add methods to prototype
  if (plugin.methods) {
    Object.assign(NuclProto, plugin.methods)
  }

  // Add properties to prototype
  if (plugin.properties) {
    Object.keys(plugin.properties).forEach(key => {
      Object.defineProperty(NuclProto, key, plugin.properties![key])
    })
  }

  // Register hooks
  if (plugin.onCreate) {
    registry.createHooks.push(plugin.onCreate)
  }

  if (plugin.onDecay) {
    registry.decayHooks.push(plugin.onDecay)
  }

  // Call install hook
  plugin.onInstall?.()
}

/**
 * Nucl prototype - extends Quark prototype
 */
export const NuclProto = Object.create(Object.getPrototypeOf(createQu()))

// Override decay to call plugin hooks
const originalDecay = NuclProto.decay
NuclProto.decay = function(this: any) {
  // Call plugin decay hooks
  registry.decayHooks.forEach(hook => hook(this))

  // Call original decay
  return originalDecay.call(this)
}

/**
 * Create Nucl instance
 */
export function Nucl<T = any>(options?: QuOptions<T> | T): any {
  // Handle shorthand: Nucl(value) instead of Nucl({ value })
  const opts = (options !== null && typeof options === 'object' && 'value' in options)
    ? options as QuOptions<T>
    : { value: options as T }

  // Create quark
  const nucl = createQu(opts)

  // Set Nucl prototype
  Object.setPrototypeOf(nucl, NuclProto)

  // Call plugin create hooks
  registry.createHooks.forEach(hook => hook(nucl))

  return nucl
}

// Export types from Quark
export type { QuOptions }
