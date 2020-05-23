/**
 * Модуль входа в библиотеку.
 * @remarks
 * Сборка всех частей библиотеки в {@link IAtomConstructor| A} константе.
 *
 * Импорт модуля устанавливает все модули-расширения библиотеки.
 * @public
 * @packageDocumentation
 */

import { AC, IAtomCoreConstructor, installAtomExtension, MaybeAny, IAtom } from '../atom/src'
import { ComputeStrategicAtom, from, installComputedExtension } from '../ext-computed/index'
import { alive } from '../atom/src/utils'
import { installMatchingExtension } from '../ext-matching/index'

installComputedExtension()
installMatchingExtension()

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
  from(...atoms) {
    return (A() as any).from(...atoms)
  },
  stateless() {
    return A().stateless()
  },
  holistic() {
    return A().holistic()
  },
  id(id, v) {
    const a = A().setId(id)
    alive(v) && a(v)
    return a
  },
}) as any) as IAtomConstructor<any>

export default A

export { IAtom } from '../atom/src'
