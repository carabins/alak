// @ts-nocheck
/**
 * Коренной модуль атома
 * @remarks
 * Атом - это функция-контейнер, предназначенная для атомарной доставки данных
 * в дочерние функции-получатели.
 *
 * - Передача значения в функцию-атом установит значение контейнера и
 * доставит значение в функции-получатели.
 *
 * - Вызов функции-атома без аргументов - вернёт текущее
 * значение контейнера если оно есть.
 * @packageDocumentation
 */

import { createAtom } from './create'
import { alive } from './utils'

export { installAtomExtension } from './create'

export const A = Object.assign(createAtom, {
  setOnceGet(getterFun) {
    return createAtom().setOnceGet(getterFun)
  },
  setGetter(getterFun) {
    return createAtom().setGetter(getterFun)
  },
  setWrapper(wrapperFun) {
    return createAtom().setWrapper(wrapperFun)
  },
  from(...atoms) {
    return createAtom().from(...atoms)
  },
  stateless() {
    return createAtom().stateless()
  },
  holistic() {
    return createAtom().holistic()
  },
  id(id, v) {
    const a = createAtom().setId(id)
    alive(v) && a(v)
    return a
  },
}) as IAtomConstructor<any>

export default A
