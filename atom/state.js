"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FState = {
    AWAIT: 'await',
    EMPTY: 'empty',
};
function notifyStateListeners(atom, state, ...value) {
    if (atom.stateListeners && atom.stateListeners.has(state)) {
        atom.stateListeners.get(state).forEach(f => f.apply(f, value));
    }
}
exports.notifyStateListeners = notifyStateListeners;
function addStateEventListener(atom, state, fun) {
    if (!atom.stateListeners)
        atom.stateListeners = new Map();
    if (!atom.stateListeners.has(state)) {
        let set = new Set();
        set.add(fun);
        atom.stateListeners.set(state, set);
    }
    else
        atom.stateListeners.get(state).add(fun);
}
exports.addStateEventListener = addStateEventListener;
function removeStateEventListener(atom, state, fun) {
    if (atom.stateListeners && atom.stateListeners.has(state)) {
        let ase = atom.stateListeners.get(state);
        if (ase.has(fun))
            ase.delete(fun);
    }
}
exports.removeStateEventListener = removeStateEventListener;
