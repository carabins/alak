/**
 * Типы для ComputedPlugin
 * @packageDocumentation
 */

/**
 * Расширение INucleus методами ComputedPlugin
 * @remarks
 * Добавляет метод `from()` для создания вычисляемых nucleus
 */
declare global {
  interface INucleusPluginMethods<T> {
    /**
     * Создать нуклон из нескольких других нуклонов и стратегии вычисления.
     * @param nucleons - набор входных нуклонов для вычисления значения
     * @returns {@link ext-computed#ComputeStrategy}
     */
    from<IN extends INucleus<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>

    /**
     * Список производных нуклонов {@link from}
     * @returns INucleus<any>[]
     */
    parents: INucleus<any>[]
  }
}

export {}
