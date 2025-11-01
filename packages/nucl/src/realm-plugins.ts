/**
 * Functions for realm-wide plugins
 */

import type { NuclPlugin } from './types'

// Global registry for realm-wide plugins
const realmPluginRegistry = new Map<string, Set<NuclPlugin>>()

/**
 * Install plugins globally for a specific realm
 */
export function useRealmPlugins(realm: string, ...plugins: NuclPlugin[]): void {
  if (!realmPluginRegistry.has(realm)) {
    realmPluginRegistry.set(realm, new Set())
  }
  
  const realmPlugins = realmPluginRegistry.get(realm)!
  
  for (const plugin of plugins) {
    if (!realmPlugins.has(plugin)) {
      realmPlugins.add(plugin)
    }
  }
}

/**
 * Get plugins for a specific realm
 */
export function getRealmPlugins(realm: string): NuclPlugin[] {
  return realmPluginRegistry.has(realm) 
    ? Array.from(realmPluginRegistry.get(realm)!) 
    : []
}