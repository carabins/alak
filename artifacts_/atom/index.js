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
    get A () {
        return A;
    },
    get Atom () {
        return Atom;
    },
    get MultiAtomic () {
        return MultiAtomic;
    },
    get coreAtom () {
        return coreAtom;
    },
    get savedAtom () {
        return savedAtom;
    }
});
const _cloudcreate = /*#__PURE__*/ _interop_require_default(require("./cloud.create"));
_export_star(require("./property"), exports);
_export_star(require("./storage"), exports);
function _export_star(from, to) {
    Object.keys(from).forEach(function(k) {
        if (k !== "default" && !Object.prototype.hasOwnProperty.call(to, k)) {
            Object.defineProperty(to, k, {
                enumerable: true,
                get: function() {
                    return from[k];
                }
            });
        }
    });
    return from;
}
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const savedAtom = (name, model)=>Atom({
        model,
        name,
        saved: true
    });
const coreAtom = (model)=>new Proxy(Atom({
        model
    }), {
        get (a, k) {
            return a.core[k];
        }
    });
const Atom = _cloudcreate.default;
const A = _cloudcreate.default;
class MultiAtomic {
}
