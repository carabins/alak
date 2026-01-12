"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _index = /*#__PURE__*/ _interop_require_default(require("@alaq/nucleus/index"));
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function awakeNucleon(n, getNucleon, thisContext, computeFn, finalListener) {
    const upDateOn = {};
    const proxyContext = new Proxy(thisContext, {
        get (target, p) {
            getNucleon(p);
            if (typeof p === 'string') {
                upDateOn[p] = true;
            }
            return target[p];
        }
    });
    n(computeFn.apply(proxyContext));
    Object.keys(upDateOn).forEach((nucleonKey)=>{
        const subNucleon = getNucleon(nucleonKey);
        subNucleon.next(finalListener);
    });
}
function _default(electrons, domain) {
    const sleepingNucleons = {};
    Object.keys(electrons.getters).forEach((key)=>{
        const n = _index.default.id(domain + '.' + key);
        const computeFn = electrons.getters[key];
        const finalListener = ()=>{
            const result = computeFn.apply(electrons.state);
            n(result);
        };
        n.addMeta('sleep', ()=>awakeNucleon(n, electrons.getNucleon, electrons.state, computeFn, finalListener));
        sleepingNucleons[key] = n;
    });
    return sleepingNucleons;
}
