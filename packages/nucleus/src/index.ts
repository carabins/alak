/**
 * Коренной модуль нуклона
 * @remarks
 * Нуклон - это функция-контейнер, предназначенная для нуклонарной доставки данных
 * в дочерние функции-получатели.
 *
 * - Передача значения в функцию-нуклон установит значение контейнера и
 * доставит значение в функции-получатели.
 *
 * - Вызов функции-нуклона без аргументов - вернёт текущее
 * значение контейнера если оно есть.
 * @packageDocumentation
 */

import { createNucleon } from './create'
import { alive } from './utils'

import { nucleonExtensions } from './create'
export const installNucleonExtensions = nucleonExtensions

export const N = Object.assign(createNucleon, {
  setOnceGet(getterFun) {
    return createNucleon().setOnceGet(getterFun)
  },
  setGetter(getterFun) {
    return createNucleon().setGetter(getterFun)
  },
  setWrapper(wrapperFun) {
    return createNucleon().setWrapper(wrapperFun)
  },
  from(...nucleons) {
    return createNucleon().from(...nucleons)
  },
  stateless() {
    return createNucleon().stateless()
  },
  holistic() {
    return createNucleon().holistic()
  },
  id(id, v) {
    const a = createNucleon().setId(id)
    alive(v) && a(v)
    return a
  },
}) as INucleonConstructor<any>

export const Nucleus = N
export default N
