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

import { createProtoAtom, createAtom } from './create'
import { alive } from './utils'

export { installAtomExtension } from './create'

export const A = Object.assign(createProtoAtom, {
  proxy: createAtom,
  proto: createProtoAtom,
  setOnceGet(getterFun) {
    return createProtoAtom().setOnceGet(getterFun)
  },
  setGetter(getterFun) {
    return createProtoAtom().setGetter(getterFun)
  },
  setWrapper(wrapperFun) {
    return createProtoAtom().setWrapper(wrapperFun)
  },
  from(...atoms) {
    return createProtoAtom().from(...atoms)
  },
  stateless() {
    return createProtoAtom().stateless()
  },
  holistic() {
    return createProtoAtom().holistic()
  },
  id(id, v) {
    const a = createProtoAtom().setId(id)
    alive(v) && a(v)
    return a
  },
}) as IAtomConstructor<any>
