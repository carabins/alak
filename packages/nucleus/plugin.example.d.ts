/**
 * Пример расширения типов для кастомного плагина
 * @packageDocumentation
 * @remarks
 * Этот файл демонстрирует как создать типизированный плагин для Nucleus
 */

/**
 * Пример 1: Простой плагин с одним методом
 */
declare global {
  interface INucleusPluginMethods<T> {
    /**
     * Пример метода плагина - удваивает значение
     * @returns удвоенное значение
     */
    double(): T extends number ? number : never
  }
}

/**
 * Пример 2: Vue плагин (для @alaq/nucleus-vue)
 */
declare module '@alaq/nucleus-vue' {
  import type { Ref, UnwrapNestedRefs } from 'vue'

  // Расширяем INucleus методами Vue плагина
  declare global {
    interface INucleusPluginMethods<T> {
      /**
       * Конвертировать nucleus в Vue ref
       * @returns Vue Ref с двусторонней синхронизацией
       */
      toRef(): Ref<T>

      /**
       * Конвертировать nucleus в Vue reactive
       * @returns Vue reactive object
       */
      toReactive(): UnwrapNestedRefs<T>

      /**
       * Синхронизировать nucleus с Vue ref
       * @param vueRef - Vue ref для синхронизации
       */
      syncWith(vueRef: Ref<T>): void
    }
  }

  /**
   * Vue плагин для Nucleus
   */
  export const VuePlugin: NucleusPlugin

  export default VuePlugin
}

/**
 * Пример 3: React плагин (для @alaq/nucleus-react)
 */
declare module '@alaq/nucleus-react' {
  // React hooks для работы с nucleus
  export function useNucleus<T>(nucleus: INucleus<T>): [T, (v: T) => void]
  export function useNucleusValue<T>(nucleus: INucleus<T>): T
  export function useAtom<M>(atom: IAtom<M>): {
    state: M
    core: IAtomCore<M>
    actions: any
  }

  /**
   * React плагин для Nucleus
   */
  export const ReactPlugin: NucleusPlugin

  export default ReactPlugin
}

/**
 * Пример 4: Svelte плагин (для @alaq/nucleus-svelte)
 */
declare module '@alaq/nucleus-svelte' {
  type Unsubscriber = () => void

  // Расширяем INucleus методами Svelte Store
  declare global {
    interface INucleusPluginMethods<T> {
      /**
       * Svelte store subscribe method
       * @param subscriber - функция подписки
       * @returns функция отписки
       */
      subscribe(subscriber: (value: T) => void): Unsubscriber

      /**
       * Svelte store set method
       * @param value - новое значение
       */
      set(value: T): void

      /**
       * Svelte store update method
       * @param fn - функция обновления
       */
      update(fn: (value: T) => T): void
    }
  }

  /**
   * Svelte плагин для Nucleus
   */
  export const SveltePlugin: NucleusPlugin

  export default SveltePlugin
}

export {}
