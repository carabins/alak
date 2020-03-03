/**
 * Корневой модуль библиотеки.
 * @remarks
 * Сборка всех частей библиотеки в {@link AConstant| A} константе.
 *
 * Импорт модуля устанавливает все модули-расширения библиотеки.
 * @public
 * @packageDocumentation
 */

import { AC, AtomCreator, installExtension, MaybeAny, ProxyAtom } from '../core/index'
import { ComputeStrategicAtom, from, installComputedExtension } from '../ext-computed/index'
import { alive } from '../core/utils'
import { installMatchingExtension } from '../ext-matching/index'

installComputedExtension()
installMatchingExtension()

// // @ts-ignore
// declare module 'alak/core' {
//   // @ts-ignore
//   import { ComputeStrategy } from 'alak/ext-computed'
//   interface ProxyAtom<T> {
//     match(...pattern: any[]): ProxyAtom<T>
//     from<A extends ProxyAtom<any>[]>(...a: A): ComputeStrategy<T, A>
//   }
// }
// installExtension({
//   handlers: {
//     from: fromFlows,
//   },
// })
/** Конструктор атома
 * @remarks
 * Функция-константа, расширяет {@link core#AtomCreator}
 * @example
 * ```javascript
 * const atom = A() // сокращённая запись A.proxy()
 * ```
 * */
export interface AConstant<D> extends AtomCreator {
  <T>(value?: T): ProxyAtom<MaybeAny<T>>

  /**
   * Создать атом c предустановленным идентификатором {@link ProxyAtom.setId}.
   * @remarks
   * Сокращённая запись  `A().setId(id)`
   * @param id - идентификатор
   * @param startValue - стартовое значение
   */
  id<T>(id: string | number, startValue?:T): ProxyAtom<MaybeAny<T>>

  /**
   * Создать атом c функцией обёртки {@link ProxyAtom.useWrapper}.
   * @remarks
   * Сокращённая запись `A().useWrapper(wrapperFun)`
   * @param wrapperFun - функция-обёртка
   */
  wrap<T>(wrapperFun: (v:D) => T): ProxyAtom<MaybeAny<T>>
  /**
   * Создать атом c функцией добытчика {@link ProxyAtom.useGetter}.
   * @remarks
   * Сокращённая запись `A().useGetter(fun)`
   * @param getterFn - функция-добытчик
   */
  getter<T>(getterFn: () => T): ProxyAtom<T>

  /**
   * Создать атом c функцией добытчика {@link ProxyAtom.useGetter}.
   * @remarks
   * Сокращённая запись `A().useOnceGet(fun)`
   * @param getterFn - функция-добытчик
   */
  getOnce<D>(getterFn: () => D): ProxyAtom<D>

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
  from<IN extends ProxyAtom<any>[]>(...atoms: IN): ComputeStrategicAtom<IN>
}
/**{@link AConstant}*/
export const A = (Object.assign(AC, {
  getOnce(getterFun) {
    return A().useOnceGet(getterFun)
  },
  getter(getterFun) {
    const a = A()
    a.useGetter(getterFun)
    return a
  },
  wrap(wrapperFun) {
    return A().useWrapper(wrapperFun)
  },
  from(...atoms){
    const a = A()
    return (a as any).from(...atoms)
  },
  id(id, v) {
    const a = A().setId(id)
    alive(v) && a(v)
    return  a
  }
}) as any) as AConstant<any>

export default A


export { ProxyAtom } from '../core/index'