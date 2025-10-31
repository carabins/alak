/**
 * Типы системы плагинов Nucleus
 * @packageDocumentation
 */

/**
 * Интерфейс плагина для nucleus
 */
interface NucleusPlugin {
  /** Уникальное имя плагина */
  name: string

  /** Методы, добавляемые к nucleus instance */
  methods?: Record<string, AnyFunction>

  /** Вызывается при создании nucleus */
  onInit?: (quark: Quark) => void

  /** Вызывается при decay nucleus */
  onDecay?: (quark: Quark) => void
}

/**
 * Базовый интерфейс для расширения INucleus через плагины
 * @remarks
 * Используйте TypeScript Module Augmentation для добавления методов плагинов:
 *
 * @example
 * ```typescript
 * // Расширение типов для кастомного плагина
 * declare global {
 *   interface INucleusPluginMethods<T> {
 *     // Методы вашего плагина
 *     customMethod(): string
 *   }
 * }
 * ```
 */
interface INucleusPluginMethods<T> {
  // Плагины добавляют свои методы через module augmentation
}
