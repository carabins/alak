/*
 * Copyright (c) 2022. Only the truth - liberates.
 */ "use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return CloudElectrons;
    }
});
class CloudElectrons {
    addEternals(keys) {
        this.savedKeys.push(...keys);
    }
    constructor(getNucleon, cloud){
        this.getNucleon = getNucleon;
        this.getters = {};
        this.actions = {};
        this.instaValues = {};
        this.savedKeys = [];
        this.core = new Proxy({}, {
            get (target, p, receiver) {
                let v = cloud.nucleons[p];
                if (v) return v;
                v = cloud.actions[p];
                if (v) return v;
                return getNucleon(p);
            }
        });
    }
}
