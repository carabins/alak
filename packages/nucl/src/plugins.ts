/**
 * Functions for realm-wide plugins
 */

import type {NuclPlugin} from './types'
import INucleusCore from "./types/core";
import {NuclProto} from "./prototype";

// Global registry for realm-wide plugins
type PluginHandler = (nuc: INucleusCore<any>) => void
type PluginChangeHandler = (nuc: INucleusCore<any>, key: string, newValue: any, oldValue: any) => void

interface PluginsRegistry {
  createHooks: PluginHandler[]
  decayHooks: PluginHandler[]
  changeHooks: PluginChangeHandler[]
  proto: any
}

const newRegistry = (plugins: NuclPlugin[]) => {
  const r = {
    createHooks: [],
    decayHooks: [],
    beforeChangeHooks: [],
    changeHooks: [],
    afterChangeHooks: [],
    proto: Object.assign({}, NuclProto)
  }
  return r
}

function updateRegistry(r: PluginsRegistry, plugins: NuclPlugin[]) {
  plugins.forEach(plugin => {
    plugin.onChange && r.changeHooks.push(plugin.onChange)
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
export function initiateRealmPlugins(realm: string, ...plugins: NuclPlugin[]): void {
  let registry = realmPluginRegistry[realm]
  if (!plugins) {
    registry = newRegistry(plugins)
  }
  realmPluginRegistry[realm] = updateRegistry(registry, plugins)
}

function getPluginsForRealm(realm:string) {
  let registry = realmPluginRegistry[realm]
  if (!registry) {
    registry = newRegistry([])
  }
  return registry
}
