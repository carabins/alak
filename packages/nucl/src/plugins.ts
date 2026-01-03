/**
 * Functions for realm-wide plugins
 */

import type {INucleonPlugin, IPluginsRegistry, PluginDeepChangeHandler} from './INucleonPlugin'
import {NuclearProto} from "./prototype";
import {INucleonCore} from "@alaq/nucl/INucleon";
import {IDeepStateChange} from "@alaq/deep-state/types";

// Global registry for realm-wide plugins

const newRegistry = (plugins: INucleonPlugin[]) => {
  const r = {
    createHooks: [],
    decayHooks: [],
    beforeChangeHooks: [],
    deepChangeHooks: [],
    proto: Object.create(NuclearProto),
    haveDeepWatch: false,
    handleWatch(n: INucleonCore, f: IDeepStateChange) {
      if (r.handleWatch) {
        const hooks = r.deepChangeHooks
        for (let i = 0; i < hooks.length; i++) {
          hooks[i](n, f)
        }
      }
    }
  }
  return r
}

function updateRegistry(r: IPluginsRegistry, plugins: INucleonPlugin[]) {
  plugins.forEach(plugin => {
    plugin.onBeforeChange && r.beforeChangeHooks.push(plugin.onBeforeChange)
    if (plugin.onDeepChange) {
      r.deepChangeHooks.push(plugin.onDeepChange)
      r.haveDeepWatch = true
    }
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


export const realmPluginRegistry = {} as Record<string, IPluginsRegistry>


/**
 * Install plugins globally for a specific realm
 */
export function createNuRealm(realm: string, ...plugins: INucleonPlugin[]): void {
  let registry = realmPluginRegistry[realm]
  if (!registry) {
    registry = newRegistry([])
  }
  realmPluginRegistry[realm] = updateRegistry(registry, plugins)
}

export function getPluginsForRealm(realm: string) {
  let registry = realmPluginRegistry[realm]
  if (!registry) {
    registry = newRegistry([])
  }
  return registry
}
