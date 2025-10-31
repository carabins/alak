/**
 * Система плагинов для nucleus
 * @packageDocumentation
 */

export interface NucleusPluginProperty {
  get?: (this: Quark) => any
  set?: (this: Quark, value: any) => void
  enumerable?: boolean
  configurable?: boolean
}

export interface NucleusPlugin {
  /** Уникальное имя плагина */
  name: string

  /** Методы, добавляемые к nucleus instance */
  methods?: Record<string, AnyFunction>

  /** Properties (getters/setters), добавляемые к nucleus instance */
  properties?: Record<string, NucleusPluginProperty>

  /** Вызывается при создании nucleus */
  onInit?: (quark: Quark) => void

  /** Вызывается при decay nucleus */
  onDecay?: (quark: Quark) => void
}

/** Глобальный реестр плагинов */
export const pluginRegistry = {
  extensions: {} as Record<string, AnyFunction>,
  properties: {} as Record<string, NucleusPluginProperty>,
  plugins: [] as NucleusPlugin[],
  initHooks: [] as Array<(quark: Quark) => void>,
  decayHooks: [] as Array<(quark: Quark) => void>,
}

/**
 * Установить плагин глобально
 * @param plugin - Плагин для установки
 */
export function installPlugin(plugin: NucleusPlugin): void {
  if (!pluginRegistry.plugins.find(p => p.name === plugin.name)) {
    pluginRegistry.plugins.push(plugin)

    if (plugin.methods) {
      Object.assign(pluginRegistry.extensions, plugin.methods)
    }
    if (plugin.properties) {
      Object.assign(pluginRegistry.properties, plugin.properties)
    }
    if (plugin.onInit) {
      pluginRegistry.initHooks.push(plugin.onInit)
    }
    if (plugin.onDecay) {
      pluginRegistry.decayHooks.push(plugin.onDecay)
    }
  }
}

/**
 * Установить несколько плагинов
 * @param plugins - Массив плагинов
 */
export function installPlugins(plugins: NucleusPlugin[]): void {
  plugins.forEach(installPlugin)
}
