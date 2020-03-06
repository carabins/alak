"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alive = v => (v !== undefined && v !== null);
exports.isTruth = v => !!v;
exports.noneFilter = f => v => (!exports.alive(v) ? f(v) : null);
exports.someFilter = f => v => (exports.alive(v) ? f(v) : null);
exports.trueFilter = f => v => (exports.isTruth(v) ? f(v) : null);
exports.someFalseFilter = f => v => (exports.alive(v) && !exports.isTruth(v) ? f(v) : null);
exports.falseFilter = f => v => (!exports.isTruth(v) ? f(v) : null);
exports.DECAY_ATOM_ERROR = 'Attempt to pass into the decayed atom';
exports.PROPERTY_ATOM_ERROR = 'undefined atom property';
exports.AtomContext = {
    direct: 'direct',
    getter: 'getter',
    fmap: 'fmap',
};
exports.deleteParams = o => {
    Object.keys(o).forEach(k => {
        if (o[k])
            o[k] = null;
        delete o[k];
    });
};
function isPromise(obj) {
    return (!!obj &&
        (typeof obj === 'object' || typeof obj === 'function') &&
        typeof obj.then === 'function');
}
exports.isPromise = isPromise;
