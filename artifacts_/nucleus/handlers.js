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
    get handlers () {
        return handlers;
    },
    get props () {
        return props;
    }
});
const _quark = require("./quark");
const _events = require("./events");
const _utils = require("./utils");
const _computed = require("./computed");
const valueProp = 'value';
const props = {
    isEmpty () {
        return !this.hasOwnProperty(valueProp);
    },
    isFilled () {
        return this.hasOwnProperty(valueProp);
    },
    haveListeners () {
        return this.listeners.size > 0;
    },
    [Symbol.toPrimitive] () {
        return this._.toString();
    }
};
const applyValue = (q, f)=>q.hasOwnProperty(valueProp) ? (q.isHoly ? f.call(f, ...q.value) : f(q.value, q), true) : false;
const handlers = {
    up (f) {
        // console.log(':::: Up', f)
        this.listeners.add(f);
        applyValue(this._, f);
        return this._;
    },
    down (f) {
        if (this.listeners.has(f)) this.listeners.delete(f);
        else if (this.grandListeners && this.grandListeners.has(f)) this.grandListeners.delete(f);
        return this._;
    },
    silent (value) {
        this.value = value;
        return this._;
    },
    curry () {
        const ctx = this;
        return function(v) {
            (0, _quark.setNucleonValue)(ctx, v);
        };
    },
    decay (silent) {
        !silent && (0, _events.dispatchEvent)(this, _events.QState.CLEAR, _events.ClearState.DECAY);
        this.listeners.clear();
        this.grandListeners && this.grandListeners.clear();
        this.stateListeners && this.stateListeners.clear();
        this.haveFrom && delete this.haveFrom;
        delete this.value;
        this.risen && this.risen.forEach((f)=>f());
        (0, _utils.deleteParams)(this);
    },
    clearValue () {
        (0, _events.dispatchEvent)(this, _events.QState.CLEAR, _events.ClearState.VALUE);
        delete this.value;
        return this._;
    },
    resend () {
        (0, _quark.notifyListeners)(this);
        return this._;
    },
    mutate (mutator) {
        this.value = mutator(this.value);
        (0, _quark.notifyListeners)(this);
        return this._;
    },
    next (f) {
        this.listeners.add(f);
        return this._;
    },
    once (f) {
        if (!applyValue(this._, f)) {
            const once = (v)=>{
                this.listeners.delete(once);
                f(v);
            };
            this.listeners.add(once);
        }
        return this._;
    },
    is (value) {
        if (!this._.isEmpty) {
            return this.value === value;
        } else {
            return value === undefined;
        }
    },
    parentFor (nucleon, name) {
        let parents = nucleon.getMeta('parents');
        if (!parents) {
            parents = {};
            nucleon.addMeta('parents', parents);
        }
        const trueName = name | 1;
        const prevNucleon = parents[trueName];
        prevNucleon && prevNucleon.down(nucleon);
        parents[trueName] = this._;
        this._.up(nucleon);
    },
    onClear (fun) {
        (0, _events.addEventListener)(this, _events.QState.CLEAR, fun);
    },
    offClear (fun) {
        (0, _events.removeEventListener)(this, _events.QState.CLEAR, fun);
    },
    onAwait (fun) {
        (0, _events.addEventListener)(this, _events.QState.AWAIT, fun);
    },
    offAwait (fun) {
        (0, _events.removeEventListener)(this, _events.QState.AWAIT, fun);
    },
    upDown (fun) {
        (0, _quark.grandUpFn)(this, fun, (0, _utils.upDownFilter)(fun));
        return this._;
    },
    upSome (fun) {
        (0, _quark.grandUpFn)(this, fun, _utils.someFilter);
        return this._;
    },
    upTrue (fun) {
        (0, _quark.grandUpFn)(this, fun, _utils.trueFilter);
        return this._;
    },
    upFalse (fun) {
        (0, _quark.grandUpFn)(this, fun, _utils.falseFilter);
        return this._;
    },
    upSomeFalse (fun) {
        (0, _quark.grandUpFn)(this, fun, _utils.someFalseFilter);
        return this._;
    },
    upNone (fun) {
        (0, _quark.grandUpFn)(this, fun, _utils.noneFilter);
        return this._;
    },
    setId (id) {
        this.id = id;
        return this._;
    },
    setName (value) {
        this._name = value;
        Object.defineProperty(this, 'name', {
            value
        });
        return this._;
    },
    finite (v) {
        if (v == undefined) this.isFinite = true;
        else this.isFinite = v;
        return this._;
    },
    holistic (v) {
        if (v == undefined) this.isHoly = true;
        else this.isHoly = v;
        return this._;
    },
    stateless (v) {
        if (v == undefined) this.isStateless = true;
        else this.isStateless = v;
        if (this.isStateless) this._.clearValue();
        return this._;
    },
    bind (context) {
        if (this._context != context) {
            this._context = context;
            this.bind(context);
        }
    },
    apply (context, v) {
        this.bind(context);
        (0, _quark.setNucleonValue)(this, v[0]);
    },
    call (context, ...v) {
        this._(...v);
    },
    addMeta (metaName, value) {
        if (!this.metaMap) this.metaMap = new Map();
        this.metaMap.set(metaName, value ? value : null);
        return this._;
    },
    deleteMeta (metaName) {
        if (!this.metaMap) return false;
        return this.metaMap.delete(metaName);
    },
    hasMeta (metaName) {
        if (!this.metaMap) return false;
        return this.metaMap.has(metaName);
    },
    getMeta (metaName) {
        if (!this.metaMap) return null;
        return this.metaMap.get(metaName);
    },
    dispatch (event, ...value) {
        (0, _events.dispatchEvent)(this, event, ...value);
        return this._;
    },
    on (stateEvent, fn) {
        (0, _events.addEventListener)(this, stateEvent, fn);
        return this._;
    },
    off (stateEvent, fn) {
        (0, _events.removeEventListener)(this, stateEvent, fn);
        return this._;
    },
    setGetter (getterFunction, isAsync) {
        this.getterFn = getterFunction;
        this.isAsync = isAsync;
        return this._;
    },
    setOnceGet (getterFunction, isAsync) {
        this.getterFn = ()=>{
            delete this.getterFn;
            delete this.isAsync;
            return getterFunction();
        };
        this.isAsync = isAsync;
        return this._;
    },
    setWrapper (wrapperFunction, isAsync) {
        this.wrapperFn = wrapperFunction;
        this.isAsync = isAsync;
        return this._;
    },
    tuneTo (a) {
        this.tuneOff();
        this.tunedTarget = a;
        a.up(this._);
    },
    tuneOff () {
        this.tunedTarget && this.tunedTarget.down(this.tunedTarget);
    },
    injectTo (o, key) {
        if (!key) {
            key = this._name ? this._name : this.id ? this.id : this.uid;
        }
        if (!o) throw 'trying inject quark to null object';
        o[key] = this.value;
        return this._;
    },
    cloneValue () {
        return JSON.parse(JSON.stringify(this.value));
    },
    [Symbol.toPrimitive] () {
        this._.toString();
    },
    [Symbol.dispose] () {
        this._.decay();
    },
    toString () {
        return `nucleon:${this._.uid}`;
    },
    valueOf () {
        return `nucleon:${this._.uid}`;
    },
    from: _computed.from
};
