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
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get N () {
        return N;
    },
    get Nucleus () {
        return Nucleus;
    },
    get Q () {
        return _bus.Q;
    },
    get QuarkEventBus () {
        return _bus.QuarkEventBus;
    },
    get default () {
        return _default;
    },
    get installNucleonExtensions () {
        return installNucleonExtensions;
    },
    get nucleonExtensions () {
        return _create.nucleonExtensions;
    }
});
const _create = require("./create");
const _utils = require("./utils");
const _bus = require("@alaq/nucleus/bus");
const installNucleonExtensions = _create.nucleonExtensions;
const N = Object.assign(_create.createNucleus, {
    setOnceGet (getterFun) {
        return (0, _create.createNucleus)().setOnceGet(getterFun);
    },
    setGetter (getterFun) {
        return (0, _create.createNucleus)().setGetter(getterFun);
    },
    setWrapper (wrapperFun) {
        return (0, _create.createNucleus)().setWrapper(wrapperFun);
    },
    from (...nucleons) {
        return (0, _create.createNucleus)().from(...nucleons);
    },
    stateless () {
        return (0, _create.createNucleus)().stateless();
    },
    holistic () {
        return (0, _create.createNucleus)().holistic();
    },
    id (id, v) {
        const a = (0, _create.createNucleus)().setId(id);
        (0, _utils.alive)(v) && a(v);
        return a;
    }
});
const Nucleus = globalThis['Nucleus'] = N;
const _default = N;
