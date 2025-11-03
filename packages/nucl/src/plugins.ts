/**
 * Functions for realm-wide plugins
 */

import type {NucleonPlugin, PluginsRegistry} from './types'
import INucleusCore from "./types/core";
import {NuclearProto} from "./prototype";
import defaultRealm from "./defaultRealm";

// Global registry for realm-wide plugins

const newRegistry = (plugins: NucleonPlugin[]) => {
  const r = {
    createHooks: [],
    decayHooks: [],
    beforeChangeHooks: [],
    afterChangeHooks: [],
    proto: Object.assign({}, NuclearProto)
  }
  return r
}

function updateRegistry(r: PluginsRegistry, plugins: NucleonPlugin[]) {
  plugins.forEach(plugin => {
    plugin.onBeforeChange && r.beforeChangeHooks.push(plugin.onBeforeChange)
    plugin.onAfterChange && r.afterChangeHooks.push(plugin.onAfterChange)
    plugin.onCreate && r.createHooks.push(plugin.onCreate)
    plugin.onDecay && r.decayHooks.push(plugin.onDecay)
    plugin.onInstall && r.decayHooks.push(plugin.onInstall)
    if (plugin.methods) {
      Object.assign(r.proto, plugin.methods)
    }

    if (plugin.properties) {
      Object.keys(plugin.properties).forEach(key => {
        Object.defineProperty(r.proto, key, plugin.properties![key])
      })
    }
  })
  return r
}


export const realmPluginRegistry = {} as Record<string, PluginsRegistry>


/**
 * Install plugins globally for a specific realm
 */
export function createNuRealm(realm: string, ...plugins: NucleonPlugin[]): void {
  let registry = realmPluginRegistry[realm]
  if (!registry) {
    registry = newRegistry([])
  }
  realmPluginRegistry[realm] = updateRegistry(registry, plugins)
}

export function getPluginsForRealm(realm:string) {
  let registry = realmPluginRegistry[realm]
  if (!registry) {
    registry = newRegistry([])
  }
  return registry
}
