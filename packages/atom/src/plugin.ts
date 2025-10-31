/**
 * @alaq/atom - Plugin system
 */

import type { AtomPlugin } from './types'

/**
 * Global plugin registry
 */
const registry = {
  plugins: [] as AtomPlugin[]
}

/**
 * Register atom plugin globally
 *
 * @example
 * ```ts
 * import { use } from '@alaq/atom'
 * import { persistPlugin } from '@alaq/atom-persist'
 *
 * use(persistPlugin)
 * ```
 */
export function use(plugin: AtomPlugin): void {
  // Check if already installed
  const exists = registry.plugins.find(p => p.symbol === plugin.symbol)
  if (exists) {
    return
  }

  registry.plugins.push(plugin)
}

/**
 * Get all registered plugins
 */
export function getPlugins(): AtomPlugin[] {
  return registry.plugins
}

/**
 * Clear all plugins (for testing)
 */
export function clearPlugins(): void {
  registry.plugins = []
}
