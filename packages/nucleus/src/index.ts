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

import {
  addEventListener,
  removeEventListener,
  dispatchEvent,
  removeListener,
} from '@alaq/nucleus/events'
import { createNucleon, nucleonExtensions } from './create'
import { alive, rnd } from './utils'

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

export function QuarkEventBus(id?) {
  const q = {} as Quark
  const removeEverythingListener = (l) => {
    if (q.everythingListeners?.has(l)) {
      q.everythingListeners.delete(l)
    }
  }
  return {
    id: id | rnd(),
    addEverythingListener(listener) {
      if (!q.everythingListeners) q.everythingListeners = new Set()
      q.everythingListeners.add(listener)
    },
    addEventListener: (event: string, listener) => addEventListener(q, event, listener),
    removeEventListener: (listener, event) => {
      removeEverythingListener(listener)
      removeEventListener(q, event, listener)
    },
    removeListener: (listener) => {
      removeListener(q, listener)
      removeEverythingListener(listener)
    },
    dispatchEvent: (event: string, data) => {
      if (q.everythingListeners) {
        q.everythingListeners.forEach((f) => f(event, data))
      }
      dispatchEvent(q, event, data)
    },
    getListenersMap: () => {
      if (!q.stateListeners) q.stateListeners = new Map()
      return q.stateListeners
    },
    connectEventBus(event: string, bus: QuarkBus<any, any>) {
      addEventListener(q, event, (v) => bus.dispatchEvent(event, v))
    },
  } as QuarkBus<any, any>
}

export const Q = QuarkEventBus

export const Nucleus = N
export default N
