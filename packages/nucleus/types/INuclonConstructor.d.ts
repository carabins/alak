/** Конструктор нуклона
 * @remarks
 * Функция-константа, расширяет {@link src#INucleonQuarkConstructor}
 * ```
 * */
interface INucleonConstructor<D> extends INucleonQuarkConstructor {
  <T>(value?: T): INucleus<MaybeAny<T>>

  /**
   * Создать нуклон c предустановленным идентификатором
   * то же что и  {@link INucleus.setId}.
   */
  id<T>(id: string | number, startValue?: T): INucleus<MaybeAny<T>>

  /**
   * Создать нуклон c функцией обёртки
   * то же что и {@link INucleus.setWrapper}.
   */
  setWrapper<T>(wrapperFun: (v: D) => T): INucleus<MaybeAny<T>>
  /**
   * Создать нуклон c функцией добытчика
   */
  setGetter<T>(getterFn: () => T): INucleus<T>

  /**
   * Создать нуклон c функцией добытчика вызываемый только раз
   */
  setOnceGet<D>(getterFn: () => D): INucleus<D>
  /**
   * Создать нуклон, с контейнерем не запоминающием значение.
   */
  stateless(): INucleus<MaybeAny<D>>
  /**
   * Создать нуклон, с аргументами передающимися в функции-добытчики в полном числе.
   */
  holistic(): INucleus<MaybeAny<D>>
  /**
   * Создать нуклон из нескольких других нуклонов и стратегии вычисления.
   * Смотрите описание стратегий: {@link ext-computed#ComputeStrategy}.
   * @example
   * ```javascript
   * const a1 = A(1)
   * const a2 = A(2)
   * const computedNucleon = A
   *          .from(a1, a2)
   *          .some((v1, v2) => v1 + v2)
   * console.log(computedNucleon()) //output:3
   * ```
   * @param nucleons - набор входных нуклонов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends INucleus<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>
}
