"use strict";
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
    get createQuark () {
        return createQuark;
    },
    get grandUpFn () {
        return grandUpFn;
    },
    get notifyListeners () {
        return notifyListeners;
    },
    get setNucleonValue () {
        return setNucleonValue;
    }
});
const _events = require("./events");
const _utils = require("./utils");
function setNucleonValue(quark, value) {
    const setValue = (finalValue)=>{
        if (quark.wrapperFn) {
            const wrappedValue = quark.wrapperFn(finalValue, quark.value);
            if (wrappedValue && wrappedValue.then) {
                return setAsyncValue(quark, wrappedValue);
            }
            finalValue = wrappedValue;
        }
        if (quark.isFinite && quark.value == finalValue) {
            return;
        }
        quark.prev = quark.value;
        quark.value = finalValue;
        notifyListeners(quark);
        if (quark.isStateless) delete quark.value;
        delete quark.prev;
        return finalValue;
    };
    if (value && value.then) {
        return setAsyncValue(quark, value);
    }
    return setValue(value);
}
async function setAsyncValue(quark, promise) {
    (0, _events.dispatchEvent)(quark, _events.QState.AWAIT, true);
    quark.isAwaiting = promise;
    quark.isAsync = true;
    const v = await promise;
    if (quark.isFinite && quark.value == v) {
        return;
    }
    quark.prev = quark.value;
    quark.value = v;
    quark.isAwaiting = false;
    (0, _events.dispatchEvent)(quark, _events.QState.AWAIT, false);
    notifyListeners(quark);
    if (quark.isStateless) delete quark.value;
    delete quark.prev;
    return v;
}
function notifyListeners(quark) {
    const v = quark.value;
    const apply = quark.isHoly ? (f)=>f(...v) : (f)=>f.length == 2 ? f(v, quark._) : f(v);
    quark.listeners.size > 0 && quark.listeners.forEach(apply);
    quark.grandListeners && quark.grandListeners.size > 0 && quark.grandListeners.forEach(apply);
}
function grandUpFn(quark, keyFun, grandFun) {
    if (!quark.grandListeners) quark.grandListeners = new Map();
    const grandUpFun = grandFun(keyFun.bind(quark._));
    quark.grandListeners.set(keyFun, grandUpFun);
    !quark._.isEmpty && grandUpFun(quark.value);
}
const createQuark = (...a)=>{
    const quark = function(...v) {
        if (v.length) {
            const value = quark.isHoly ? v : v[0];
            return setNucleonValue(quark, value);
        } else {
            if (quark.isStateless) {
                notifyListeners(quark);
                return;
            }
            if (quark.isAwaiting) {
                return quark.isAwaiting;
            }
            if (quark.getterFn) {
                return setNucleonValue(quark, quark.getterFn());
            }
            return quark.value;
        }
    };
    quark.listeners = new Set();
    quark.uid = (0, _utils.rnd)();
    a.length && quark(...a);
    return quark;
};
