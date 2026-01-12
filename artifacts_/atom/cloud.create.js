/*
 * Copyright (c) 2022. Only the truth - liberates.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _index = require("@alaq/nucleus/index");
const _cloudorbit = /*#__PURE__*/ _interop_require_default(require("./cloud.orbit"));
const _cloudparse = /*#__PURE__*/ _interop_require_default(require("./cloud.parse"));
const _cloudelectrons = /*#__PURE__*/ _interop_require_default(require("./cloud.electrons"));
const _utils = require("@alaq/nucleus/utils");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _default(atomOptions) {
    const cloud = {
        nucleons: {},
        actions: {},
        sleepingNucleons: {},
        superEternal: false
    };
    const known = {
        values () {
            var _known_keys;
            const o = {};
            (_known_keys = known.keys) === null || _known_keys === void 0 ? void 0 : _known_keys.forEach((k)=>{
                o[k] = electrons.state[k];
            });
            return o;
        }
    };
    const knownKeys = new Set();
    const knownActions = new Set();
    const electrons = new _cloudelectrons.default(getNucleon, cloud);
    if (atomOptions.nucleusStrategy === 'saved' || atomOptions.saved === '*') {
        cloud.superEternal = true;
    } else if (typeof atomOptions.saved !== 'string' && atomOptions.saved && typeof atomOptions.saved[0] === 'string') {
        electrons.savedKeys = atomOptions.saved;
    }
    const findElectrons = (model, isEternal)=>{
        const parts = (0, _cloudparse.default)(model, atomOptions);
        Object.assign(electrons.actions, parts.actions);
        Object.assign(electrons.getters, parts.getters);
        Object.assign(electrons.instaValues, parts.instaValues);
        electrons.addEternals(parts.saveds);
        const onlyPublic = (k)=>!k.startsWith('_');
        known.actions = new Set(Object.keys(electrons.actions).filter(onlyPublic));
        const instaKeys = Object.keys(parts.instaValues);
        instaKeys.push(...Object.keys(parts.getters));
        known.keys = new Set(instaKeys.filter(onlyPublic));
        if (isEternal) {
            electrons.addEternals(instaKeys);
        }
    };
    atomOptions.model && findElectrons(atomOptions.model);
    atomOptions.saved && findElectrons(atomOptions.saved, true);
    const externalBus = !!atomOptions.bus;
    const bus = atomOptions.bus || (0, _index.QuarkEventBus)();
    const orbital = (0, _cloudorbit.default)(electrons, cloud, atomOptions, bus);
    function getNucleon(key) {
        let nucleon = cloud.sleepingNucleons[key];
        if (nucleon) {
            const wakeup = nucleon.getMeta('sleep');
            wakeup();
            nucleon.deleteMeta('sleep');
            cloud.nucleons[key] = nucleon;
            delete cloud.sleepingNucleons[key];
        } else {
            nucleon = cloud.nucleons[key] || orbital.atom[key];
        }
        if (!knownKeys) {
            knownKeys[key] = true;
        }
        return nucleon;
    }
    const atom = {
        core: electrons.core,
        state: electrons.state,
        actions: cloud.actions,
        decay,
        bus,
        known
    };
    function decay() {
        Object.keys(knownKeys).forEach((key)=>{
            let nucleon = cloud.sleepingNucleons[key] || cloud.nucleons[key] || orbital.atom[key];
            if (nucleon) {
                nucleon.decay();
            }
        });
        if (externalBus) {
            bus.decay();
        }
        (0, _utils.deleteParams)(atom);
        (0, _utils.deleteParams)(orbital);
        (0, _utils.deleteParams)(known);
    }
    return atom;
}
