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
const _cloudgetters = /*#__PURE__*/ _interop_require_default(require("./cloud.getters"));
const _cloudproxy = require("./cloud.proxy");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _default(electrons, cloud, config, quarkBus) {
    const atom = _cloudproxy.cloudProxy.nuclear(electrons.instaValues, Object.assign({
        nucleons: {},
        quarkBus
    }, config));
    const sleepingNucleons = (0, _cloudgetters.default)(electrons, config.name);
    Object.assign(cloud.sleepingNucleons, sleepingNucleons);
    const state = _cloudproxy.cloudProxy.state(atom);
    const fullState = _cloudproxy.cloudProxy.warpNucleonGetter(electrons.getNucleon, state);
    const thisState = _cloudproxy.cloudProxy.warp(cloud.actions, fullState);
    const thisContext = config.thisExtension ? _cloudproxy.cloudProxy.warp(config.thisExtension, thisState) : thisState;
    electrons.state = thisContext;
    Object.keys(electrons.actions).forEach((key)=>{
        cloud.actions[key] = (...args)=>{
            const fn = electrons.actions[key];
            return fn.apply(thisContext, args);
        };
    });
    return {
        atom
    };
}
