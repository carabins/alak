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
    get cloudProxy () {
        return cloudProxy;
    },
    get isString () {
        return isString;
    }
});
const _nuclear = /*#__PURE__*/ _interop_require_default(require("@alaq/atom/nuclear"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const isDefined = (v)=>v !== undefined && v !== null;
const isString = (p)=>typeof p === 'string';
const cloudProxy = {
    nuclear: (valence, core)=>new Proxy({
            valence,
            core
        }, {
            get (a, key) {
                return a.core.nucleons[key] || (0, _nuclear.default)(key, valence, core);
            }
        }),
    warpNucleonGetter: (getter, core)=>new Proxy({
            getter,
            core
        }, {
            get (o, key) {
                const v = o.getter(key);
                return v ? v.value : o.core[key];
            },
            set (o, k, v) {
                o.core[k] = v;
                return true;
            }
        }),
    warp: (shell, core)=>new Proxy({
            shell,
            core
        }, {
            get (target, p) {
                const s = target.shell[p];
                return isDefined(s) ? s : target.core[p];
            },
            set (target, p, value) {
                target.core[p] = value;
                return true;
            }
        }),
    state: (atom)=>new Proxy({
            atom
        }, {
            get (target, p) {
                if (isString(p)) {
                    return target.atom[p].value;
                }
            },
            set (target, p, value) {
                if (isString(p)) {
                    target.atom[p](value);
                    return true;
                }
                return false;
            }
        })
} /*
 * Copyright (c) 2022. Only the truth - liberates.
 */ ;
