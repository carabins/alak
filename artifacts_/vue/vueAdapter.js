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
    get default () {
        return vueAtom;
    },
    get vueNucleon () {
        return vueNucleon;
    },
    get watchVueAtom () {
        return watchVueAtom;
    },
    get watchVueNucleon () {
        return watchVueNucleon;
    }
});
/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */ const Vue = require('vue');
const { ref, reactive, watch } = Vue;
const vueKey = 'vueKey';
function vueNucleon(n) {
    if (n.hasMeta(vueKey)) {
        return n.getMeta(vueKey);
    } else {
        const l = ref();
        if (n.value) {
            l.value = n.value;
        }
        n.up((v)=>l.value = v);
        return l;
    }
}
function watchVueNucleon(n) {
    const l = vueNucleon(n);
    watch(l, (v)=>{
        n(v);
    });
    return l;
}
const vueAtomKey = '__vue_reactive';
function vueAtom(atom) {
    if (!atom.known.meta) {
        atom.known.meta = {};
    }
    let r = atom.known.meta[vueAtomKey];
    const values = atom.known.values();
    if (!r) {
        r = atom[vueAtomKey] = reactive(Object.assign({}, values, atom.known.actions));
    }
    const listeners = {};
    Object.keys(values).forEach((k)=>{
        listeners[k] = (v)=>{
            r[k] = v;
        };
    });
    Object.keys(values).forEach((k)=>{
        atom.core[k].up(listeners[k]);
    });
    return r;
}
function watchVueAtom(atom) {
    const vueReactive = vueAtom(atom);
    return proxyReactiveSyncedWithAtom(vueReactive, atom.core);
}
const skip = {
    __v_raw: true
};
function proxyReactiveSyncedWithAtom(vueReactive, atomCore) {
    return new Proxy(vueReactive, {
        get (vueReactive, k) {
            if (!skip[k] && typeof k === 'string') {
                atomCore[k];
            }
            return vueReactive[k];
        },
        set (target, k, newValue, receiver) {
            target[k] = newValue;
            if (typeof k === 'string' && atomCore[k]) {
                atomCore[k](newValue);
            }
            return true;
        }
    });
}
