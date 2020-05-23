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

export { installAtomExtension } from './create'

/** {@link IAtomCoreConstructor} */
export const AC: IAtomCoreConstructor = Object.assign(createProtoAtom, {
  proxy: createAtom,
  proto: createProtoAtom,
})
