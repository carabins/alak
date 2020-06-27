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

import { createProtoAtom, createProxyAtom } from './create'
import { alive } from './utils'

export { installAtomExtension } from './create'

const init = (o) =>
  Object.assign(o, {
    proxy: createProxyAtom,
    proto: createProtoAtom,
    setOnceGet(getterFun) {
      return o().setOnceGet(getterFun)
    },
    setGetter(getterFun) {
      return o().setGetter(getterFun)
    },
    setWrapper(wrapperFun) {
      return o().setWrapper(wrapperFun)
    },
    from(...atoms) {
      return o().from(...atoms)
    },
    stateless() {
      return o().stateless()
    },
    holistic() {
      return o().holistic()
    },
    id(id, v) {
      const a = o().setId(id)
      alive(v) && a(v)
      return a
    },
  }) as IAtomConstructor<any>

export const AlakProxyMode = () => (A = init(createProxyAtom))
export let A: IAtomConstructor<any> = init(createProtoAtom)
export default A
