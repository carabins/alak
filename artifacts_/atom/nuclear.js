// import {installNucleonExtension} from "@alaq/nucleus/create";
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
        return _default;
    },
    get isDefined () {
        return isDefined;
    }
});
const _storage = require("./storage");
const _index = /*#__PURE__*/ _interop_require_default(require("@alaq/nucleus/index"));
const _property = require("@alaq/atom/property");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const isDefined = (v)=>v !== undefined && v !== null;
const nonNucleons = [
    'constructor'
];
function _default(key, valence, core) {
    let nucleon = core.nucleons[key];
    if (!nucleon && !nonNucleons.includes(key) && typeof key == 'string') {
        const id = core.name ? `${core.name}.${key}` : key;
        let modelValue, metaValue, mem;
        mem = core.saved;
        core.nucleons[key] = nucleon = (0, _index.default)();
        if (valence) {
            let maybeValue = valence[key];
            delete valence[key];
            if (isDefined(maybeValue)) {
                var _maybeValue_mix;
                const defineRune = (mv)=>{
                    switch(mv === null || mv === void 0 ? void 0 : mv.sym){
                        case _property.tagSym:
                            nucleon.addMeta('tag', mv.tag);
                            break;
                        case _property.savedSym:
                            mem = true;
                            break;
                        case _property.statelessSym:
                            nucleon.stateless();
                            break;
                        case _property.finiteSym:
                            nucleon.finite();
                            break;
                        case _property.wrapSym:
                            nucleon.setWrapper(mv.wrapper);
                            break;
                    }
                    if (isDefined(mv.startValue)) {
                        modelValue = mv.startValue;
                    }
                };
                switch(true){
                    case ((_maybeValue_mix = maybeValue.mix) === null || _maybeValue_mix === void 0 ? void 0 : _maybeValue_mix.length) > 1:
                        maybeValue.mix.forEach((xv)=>{
                            switch(true){
                                case typeof xv == 'function':
                                    defineRune(xv());
                                    break;
                                case typeof xv.sym === 'symbol':
                                    defineRune(xv);
                                    break;
                                default:
                                    modelValue = xv;
                            }
                        });
                        break;
                    case typeof maybeValue.sym === 'symbol':
                        defineRune(maybeValue);
                        break;
                    default:
                        modelValue = maybeValue;
                }
            }
        }
        switch(core.nucleusStrategy){
            case 'finite':
                nucleon.finite();
                break;
            case 'holistic':
                nucleon.holistic();
                break;
            case 'stateless':
                nucleon.stateless();
                break;
            case 'holystate':
                nucleon.holistic();
                nucleon.stateless();
                break;
        }
        nucleon.setId(id);
        if (mem) {
            _storage.storage.init(nucleon);
            nucleon.isEmpty && isDefined(modelValue) && nucleon(modelValue);
        } else {
            if (isDefined(modelValue)) {
                nucleon(modelValue);
            }
        }
        if (core.metaMap) {
            const tags = core.metaMap[key];
            tags === null || tags === void 0 ? void 0 : tags.forEach(nucleon.addMeta);
        }
        if (!nucleon.hasMeta('no_bus')) {
            if (core.emitChanges) {
                nucleon.up((value)=>{
                    core.quarkBus.dispatchEvent('NUCLEUS_CHANGE', {
                        key,
                        value,
                        atomId: core.name,
                        n: nucleon
                    });
                });
            }
            core.quarkBus.dispatchEvent('NUCLEUS_INIT', nucleon);
        }
    }
    return nucleon;
}
