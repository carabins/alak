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
    get createNucleus () {
        return createNucleus;
    },
    get nucleonExtensions () {
        return nucleonExtensions;
    }
});
const _quark = require("./quark");
const _handlers = require("./handlers");
const quant = {
    extensions: {}
};
function nucleonExtensions(...extensions) {
    extensions.forEach((ext)=>{
        Object.assign(quant.extensions, ext);
    });
}
const proxy = {
    get (q, key) {
        const r = q[key];
        if (r || typeof r != 'undefined' || r != null) {
            return r;
        }
        let f = quant.extensions[key] || _handlers.props[key];
        if (f) {
            return f.apply(q);
        }
        f = _handlers.handlers[key];
        if (f) {
            return (...a)=>f.call(q, ...a);
        }
        return r;
    }
};
function createNucleus(value) {
    const quark = (0, _quark.createQuark)(...arguments);
    quark._ = new Proxy(quark, proxy);
    return quark._;
}
