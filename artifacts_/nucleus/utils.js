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
    get alive () {
        return alive;
    },
    get deleteParams () {
        return deleteParams;
    },
    get falseFilter () {
        return falseFilter;
    },
    get isPromise () {
        return isPromise;
    },
    get isTruth () {
        return isTruth;
    },
    get noneFilter () {
        return noneFilter;
    },
    get rnd () {
        return rnd;
    },
    get someFalseFilter () {
        return someFalseFilter;
    },
    get someFilter () {
        return someFilter;
    },
    get trueFilter () {
        return trueFilter;
    },
    get upDownFilter () {
        return upDownFilter;
    }
});
const alive = (v)=>v !== undefined && v !== null;
const isTruth = (v)=>!!v;
const noneFilter = (f)=>(v)=>!alive(v) ? f(v) : null;
const someFilter = (f)=>(v)=>alive(v) ? f(v) : null;
const trueFilter = (f)=>(v)=>isTruth(v) ? f(v) : null;
const someFalseFilter = (f)=>(v)=>alive(v) && !isTruth(v) ? f(v) : null;
const falseFilter = (f)=>(v)=>!isTruth(v) ? f(v) : null;
const upDownFilter = (fun)=>(f)=>{
        const down = (a)=>()=>a.down(fun);
        return (v, a)=>{
            f(v, down(a));
        };
    };
const deleteParams = (o)=>{
    Object.keys(o).forEach((k)=>{
        if (o[k]) o[k] = null;
        delete o[k];
    });
};
function isPromise(obj) {
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}
const rnd = ()=>1000000000000000 * (Math.ceil(Math.random() * 9) + Math.random());
