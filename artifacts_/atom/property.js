/*
 * Copyright (c) 2022. Only the truth - liberates.
 */ "use strict";
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
    get finite () {
        return finite;
    },
    get finiteSym () {
        return finiteSym;
    },
    get mixed () {
        return mixed;
    },
    get mixedSym () {
        return mixedSym;
    },
    get saved () {
        return saved;
    },
    get savedSym () {
        return savedSym;
    },
    get stateless () {
        return stateless;
    },
    get statelessSym () {
        return statelessSym;
    },
    get tag () {
        return tag;
    },
    get tagSym () {
        return tagSym;
    },
    get wrap () {
        return wrap;
    },
    get wrapSym () {
        return wrapSym;
    }
});
const savedSym = Symbol.for('saved');
const finiteSym = Symbol.for('finite');
const tagSym = Symbol.for('tag');
const statelessSym = Symbol.for('stateless');
const mixedSym = Symbol.for('mixed');
const wrapSym = Symbol.for('wrapped');
function tagFn(...argArray) {
    const [startValue] = argArray;
    return {
        sym: tagSym,
        startValue,
        tag: true
    };
}
const tag = new Proxy(tagFn, {
    get (_, tag) {
        const tagFn = (startValue)=>{
            return {
                sym: tagSym,
                startValue,
                tag
            };
        };
        return tagFn;
    }
});
function saved(startValue) {
    return {
        sym: savedSym,
        startValue
    };
}
function mixed(...a) {
    return {
        sym: mixedSym,
        mix: a
    };
}
function stateless(startValue) {
    return {
        sym: statelessSym,
        startValue
    };
}
function finite(startValue) {
    return {
        sym: finiteSym,
        startValue
    };
}
function wrap(wrapper, startValue) {
    return {
        sym: wrapSym,
        startValue,
        wrapper
    };
}
