/**
 * Типы для Vue Nucleus Plugin
 * @packageDocumentation
 */

import type { Ref } from 'vue'

/**
 * Декларация модуля @alaq/nucleus для TypeScript компилятора
 */
declare module '@alaq/nucleus' {
  export interface NucleusPlugin {
    name: string
    methods?: Record<string, (...args: any[]) => any>
    properties?: Record<string, {
      get?: (this: any) => any
      set?: (this: any, value: any) => void
      enumerable?: boolean
      configurable?: boolean
    }>
    extensions?: Record<string, (...args: any[]) => any>
    onInit?: (quark: any) => void
    onDecay?: (quark: any) => void
  }

  export function installPlugin(plugin: NucleusPlugin): void
}

/**
 * Расширение INucleus методами Vue плагина
 */
declare global {
  interface INucleusPluginMethods<T> {
    /**
     * Конвертировать nucleus в Vue ref (односторонняя синхронизация: nucleus -> ref)
     * @returns Vue Ref синхронизированный с nucleus
     * @example
     * ```typescript
     * const count = N(0)
     * const countRef = count.toRef()
     *
     * count(5)
     * console.log(countRef.value) // 5
     * ```
     */
    toRef(): Ref<T>

    /**
     * Конвертировать nucleus в Vue ref с двусторонней синхронизацией
     * @returns Vue Ref с двусторонней синхронизацией
     * @example
     * ```typescript
     * const count = N(0)
     * const countRef = count.toReactive()
     *
     * // nucleus -> ref
     * count(5)
     * console.log(countRef.value) // 5
     *
     * // ref -> nucleus
     * countRef.value = 10
     * console.log(count()) // 10
     * ```
     */
    toReactive(): Ref<T>

    /**
     * Синхронизировать nucleus с существующим Vue ref
     * @param vueRef - Vue ref для синхронизации
     * @param bidirectional - двусторонняя синхронизация (по умолчанию true)
     * @example
     * ```typescript
     * const count = N(0)
     * const externalRef = ref(5)
     *
     * count.syncWith(externalRef)
     * console.log(count()) // 5
     * ```
     */
    syncWith(vueRef: Ref<T>, bidirectional?: boolean): void

    /**
     * Получить текущее значение как Vue ref (алиас для toRef)
     * @returns Vue Ref
     */
    asRef(): Ref<T>
  }
}

export {}
