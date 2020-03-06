"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const state_1 = require("./state");
const utils_1 = require("./utils");
exports.debug = {};
function setAtomValue(atom, value, context) {
    const setValue = finalValue => {
        if (atom.wrapperFn) {
            let wrappedValue = atom.wrapperFn(finalValue, atom.value);
            if (wrappedValue.then) {
                exports.debug.enabled && exports.debug.updateAsyncStart(atom, context);
                return setAsyncValue(atom, wrappedValue);
            }
            finalValue = wrappedValue;
        }
        atom.value = finalValue;
        exports.debug.enabled && exports.debug.updateValue(atom, context);
        notifyChildes(atom);
        return finalValue;
    };
    if (value && value.then) {
        return setAsyncValue(atom, value);
    }
    return setValue(value);
}
exports.setAtomValue = setAtomValue;
function setAsyncValue(atom, promise) {
    return __awaiter(this, void 0, void 0, function* () {
        state_1.notifyStateListeners(atom, state_1.FState.AWAIT, true);
        atom.isAwaiting = promise;
        atom.isAsync = true;
        let v = yield promise;
        atom.value = v;
        atom.isAwaiting = false;
        state_1.notifyStateListeners(atom, state_1.FState.AWAIT, false);
        exports.debug.enabled && exports.debug.updateAsyncFinish(atom);
        notifyChildes(atom);
        return v;
    });
}
function notifyChildes(atom) {
    const v = atom.value;
    atom.children.size > 0 && atom.children.forEach(f => f.call(atom._, v));
    atom.grandChildren &&
        atom.grandChildren.size > 0 &&
        atom.grandChildren.forEach((f, k) => {
            f(v);
        });
}
exports.notifyChildes = notifyChildes;
function grandUpFn(atom, keyFun, grandFun) {
    if (!atom.grandChildren)
        atom.grandChildren = new Map();
    const grandUpFun = grandFun(keyFun.bind(atom._));
    atom.grandChildren.set(keyFun, grandUpFun);
    !atom._.isEmpty && grandUpFun(atom.value);
}
exports.grandUpFn = grandUpFn;
exports.createCore = (...a) => {
    const atom = function (value, context) {
        // console.log(core)
        if (!atom.children) {
            throw utils_1.DECAY_ATOM_ERROR;
        }
        if (arguments.length) {
            if (exports.debug.enabled)
                return setAtomValue(atom, value, context ? context : utils_1.AtomContext.direct);
            else
                return setAtomValue(atom, value);
        }
        else {
            if (atom.isAwaiting) {
                return atom.isAwaiting;
            }
            if (atom.getterFn) {
                return setAtomValue(atom, atom.getterFn(), utils_1.AtomContext.getter);
            }
            return atom.value;
        }
    };
    atom.children = new Set();
    atom.uid = Math.random();
    if (a.length) {
        atom(...a);
    }
    return atom;
};
