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
    get ClearState () {
        return ClearState;
    },
    get QState () {
        return QState;
    },
    get addEventListener () {
        return addEventListener;
    },
    get dispatchEvent () {
        return dispatchEvent;
    },
    get removeEventListener () {
        return removeEventListener;
    },
    get removeListener () {
        return removeListener;
    }
});
const QState = {
    AWAIT: 'await',
    CLEAR: 'clear'
};
const ClearState = {
    VALUE: 'value',
    DECAY: 'decay'
};
function dispatchEvent(quark, state, ...value) {
    if (quark.stateListeners && quark.stateListeners.has(state)) {
        quark.stateListeners.get(state).forEach((f)=>f.apply(f, value));
    }
}
function addEventListener(quark, state, fun) {
    if (!quark.stateListeners) quark.stateListeners = new Map();
    if (!quark.stateListeners.has(state)) {
        const set = new Set();
        set.add(fun);
        quark.stateListeners.set(state, set);
    } else quark.stateListeners.get(state).add(fun);
}
function removeEventListener(quark, state, fun) {
    if (quark.stateListeners && quark.stateListeners.has(state)) {
        const ase = quark.stateListeners.get(state);
        if (ase.has(fun)) ase.delete(fun);
    }
}
function removeListener(quark, fun) {
    if (quark.stateListeners) {
        quark.stateListeners.forEach((ase)=>{
            if (ase.has(fun)) ase.delete(fun);
        });
    }
}
