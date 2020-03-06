"use strict";
/**
 * Ядро атома
 * @remarks
 * Атом - это функция-контейнер, предназначенная для множественной доставки значения контейнера
 * в дочерние функции-получатели.
 *
 * - Передача значения в функцию-атом установит значение контейнера и
 * доставит значение в функции-получатели.
 *
 * - Вызов функции-атома без аргументов - вернёт текущее
 * значение контейнера если оно есть.
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
const create_1 = require("./create");
var create_2 = require("./create");
exports.installAtomExtension = create_2.installAtomExtension;
/** {@link AtomCoreConstructor} */
exports.AC = Object.assign(create_1.createProtoAtom, {
    proxy: create_1.createAtom,
    proto: create_1.createProtoAtom,
});
