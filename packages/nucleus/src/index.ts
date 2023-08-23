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
import {createNucleus, nucleonExtensions} from './create'
import {alive, rnd} from './utils'
export {QuarkEventBus, Q} from "@alaq/nucleus/bus";

export const installNucleonExtensions = nucleonExtensions

export const N = Object.assign(createNucleus, {
    setOnceGet(getterFun) {
        return createNucleus().setOnceGet(getterFun)
    },
    setGetter(getterFun) {
        return createNucleus().setGetter(getterFun)
    },
    setWrapper(wrapperFun) {
        return createNucleus().setWrapper(wrapperFun)
    },
    from(...nucleons) {
        return createNucleus().from(...nucleons)
    },
    stateless() {
        return createNucleus().stateless()
    },
    holistic() {
        return createNucleus().holistic()
    },
    id(id, v) {
        const a = createNucleus().setId(id)
        alive(v) && a(v)
        return a
    },
}) as INucleonConstructor<any>

export const Nucleus = N
export default N
