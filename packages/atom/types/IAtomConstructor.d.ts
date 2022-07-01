/** Конструктор атома
 * @remarks
 * Функция-константа, расширяет {@link src#IAtomCoreConstructor}
 * @example
 * ```javascript
 * import A from 'alak'
 * const core = A() // сокращённая запись A.proxy()
 * ```
 * */
interface IAtomConstructor<D> extends IAtomCoreConstructor {
  <T>(value?: T): IAtom<MaybeAny<T>>

  /**
   * Создать атом c предустановленным идентификатором {@link IAtom.setId}.
   * @remarks
   * Сокращённая запись  `A().setId(id)`
   * @param id - идентификатор
   * @param startValue - стартовое значение
   */
  id<T>(id: string | number, startValue?: T): IAtom<MaybeAny<T>>

  /**
   * Создать атом c функцией обёртки {@link IAtom.setWrapper}.
   * @remarks
   * Сокращённая запись `A().setWrapper(wrapperFun)`
   * @param wrapperFun - функция-обёртка
   */
  setWrapper<T>(wrapperFun: (v: D) => T): IAtom<MaybeAny<T>>
  /**
   * Создать атом c функцией добытчика {@link IAtom.setGetter}.
   * @remarks
   * Сокращённая запись `A().setGetter(fun)`
   * @param getterFn - функция-добытчик
   */
  setGetter<T>(getterFn: () => T): IAtom<T>

  /**
   * Создать атом c функцией добытчика {@link IAtom.setGetter}.
   * @remarks
   * Сокращённая запись `A().setOnceGet(fun)`
   * @param getterFn - функция-добытчик
   */
  setOnceGet<D>(getterFn: () => D): IAtom<D>
  /**
   * Создать атом, с контейнерем не запоминающием значение.
   * {@link IAtom.stateless}.
   * @remarks
   * Сокращённая запись `A().stateless()`
   */
  stateless(): IAtom<MaybeAny<D>>
  /**
   * Создать атом, с аргументами передающимися в функции-добытчики в полном числе.
   * {@link IAtom.stateless}.
   * @remarks
   * Сокращённая запись `A().holistic()`
   */
  holistic(): IAtom<MaybeAny<D>>
  /**
   * Создать атом из нескольких других атомов и стратегии вычисления.
   * Смотрите описание стратегий: {@link ext-computed#ComputeStrategy}.
   * @example
   * ```javascript
   * const a1 = A(1)
   * const a2 = A(2)
   * const computedAtom = A
   *          .from(a1, a2)
   *          .some((v1, v2) => v1 + v2)
   * console.log(computedAtom()) //output:3
   * ```
   * @param atoms - набор входных атомов для вычисления значения
   * @returns {@link ext-computed#ComputeStrategy}
   */
  from<IN extends IAtom<any>[]>(...atoms: IN): ComputeStrategicAtom<IN>
}
