/** Конструктор нуклона
 * @remarks
 * Функция-константа, расширяет {@link src#INucleonQuarkConstructor}
 * ```
 * */
interface INucleonConstructor<D> extends INucleonQuarkConstructor {
  <T>(value?: T): INucleon<MaybeAny<T>>

  /**
   * Создать нуклон c предустановленным идентификатором
   * то же что и  {@link INucleon.setId}.
   */
  id<T>(id: string | number, startValue?: T): INucleon<MaybeAny<T>>

  /**
   * Создать нуклон c функцией обёртки
   * то же что и {@link INucleon.setWrapper}.
   */
  setWrapper<T>(wrapperFun: (v: D) => T): INucleon<MaybeAny<T>>
  /**
   * Создать нуклон c функцией добытчика
   */
  setGetter<T>(getterFn: () => T): INucleon<T>

  /**
   * Создать нуклон c функцией добытчика вызываемый только раз
   */
  setOnceGet<D>(getterFn: () => D): INucleon<D>
  /**
   * Создать нуклон, с контейнерем не запоминающием значение.
   */
  stateless(): INucleon<MaybeAny<D>>
  /**
   * Создать нуклон, с аргументами передающимися в функции-добытчики в полном числе.
   */
  holistic(): INucleon<MaybeAny<D>>
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
  from<IN extends INucleon<any>[]>(...nucleons: IN): ComputeStrategicNucleon<IN>
}
