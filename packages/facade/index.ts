/**
 * Модуль входа в библиотеку.
 * @remarks
 * Сборка всех частей библиотеки в {@link IAtomConstructor| A} константе.
 *
 * Импорт модуля устанавливает все модули-расширения библиотеки.
 * @public
 * @packageDocumentation
 */

import { AC, IAtomCoreConstructor, installAtomExtension, MaybeAny, IAtom } from '../atom/index'
import { ComputeStrategicAtom, from, installComputedExtension } from '../ext-computed/index'
import { alive } from '../atom/utils'
import { installMatchingExtension } from '../ext-matching/index'

installComputedExtension()
installMatchingExtension()


// // @ts-ignore
// declare module 'alak/core' {
//   // @ts-ignore
//   import { ComputeStrategy } from 'alak/ext-computed'
//   interface Atom<T> {
//     match(...pattern: any[]): Atom<T>
//     from<A extends Atom<any>[]>(...a: A): ComputeStrategy<T, A>
//   }
// }
// installExtension({
//   handlers: {
//     from: fromFlows,
//   },
// })
/** Конструктор атома
 * @remarks
 * Функция-константа, расширяет {@link atom#IAtomCoreConstructor}
 * @example
 * ```javascript
 * import A from 'alak'
 * const atom = A() // сокращённая запись A.proxy()
 * ```
 * */
export interface IAtomConstructor<D> extends IAtomCoreConstructor {
  <T>(value?: T): IAtom<MaybeAny<T>>

  /**
   * Создать атом c предустановленным идентификатором {@link IAtom.setId}.
   * @remarks
   * Сокращённая запись  `A().setId(id)`
   * @param id - идентификатор
   * @param startValue - стартовое значение
   */
  id<T>(id: string | number, startValue?:T): IAtom<MaybeAny<T>>

  /**
   * Создать атом c функцией обёртки {@link IAtom.setWrapper}.
   * @remarks
   * Сокращённая запись `A().setWrapper(wrapperFun)`
   * @param wrapperFun - функция-обёртка
   */
  setWrapper<T>(wrapperFun: (v:D) => T): IAtom<MaybeAny<T>>
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
   * {@link ProxyAtom.setStateless}.
   * @remarks
   * Сокращённая запись `A().setStateless()`
   */
  setStateless(bool?:boolean): IAtom<MaybeAny<D>>
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
/**{@link IAtomConstructor}*/
export const A = (Object.assign(AC, {
  setOnceGet(getterFun) {
    return A().setOnceGet(getterFun)
  },
  setGetter(getterFun) {
    return A().setGetter(getterFun)
  },
  setWrapper(wrapperFun) {
    return A().setWrapper(wrapperFun)
  },
  from(...atoms){
    return (A() as any).from(...atoms)
  },
  setStateless() {
    return A().setStateless()
  },
  id(id, v) {
    const a = A().setId(id)
    alive(v) && a(v)
    return  a
  }
}) as any) as IAtomConstructor<any>

export default A


export { IAtom } from '../atom/index'
