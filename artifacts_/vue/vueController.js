"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "vueController", {
    enumerable: true,
    get: function() {
        return vueController;
    }
});
const _UnionCore = require("alak/UnionCore");
const _vueAdapter = /*#__PURE__*/ _interop_require_wildcard(require("./vueAdapter"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
const Vue = require('vue');
function vueController(c) {
    function ctr() {
        const uc = (0, _UnionCore.GetUnionCore)(c.namespace);
        let a = uc.services.atoms[c.name];
        if (!a) {
            uc.addAtom(Object.assign({}, c));
            a = uc.services.atoms[c.name];
        }
        return {
            state: c.sync ? (0, _vueAdapter.watchVueAtom)(a) : (0, _vueAdapter.default)(a),
            core: a.core
        };
    }
    return ctr;
}
