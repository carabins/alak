/// <reference path="types.d.ts" />
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
import { nucleonExtensions } from './create';
export { QuarkEventBus, Q } from '@alaq/nucleus/bus';
export declare const installNucleonExtensions: typeof nucleonExtensions;
export { nucleonExtensions };
export declare const N: INucleonConstructor<any>;
export declare const Nucleus: INucleonConstructor<any>;
export default N;
