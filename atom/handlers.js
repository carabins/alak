"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
const state_1 = require("./state");
const utils_1 = require("./utils");
const valueProp = 'value';
exports.coreProps = {
    isEmpty: {
        get() {
            return !this.hasOwnProperty(valueProp);
        },
    },
};
exports.proxyProps = {
    value() {
        return this.value;
    },
    isEmpty() {
        return !this.hasOwnProperty(valueProp);
    },
    uid() {
        return this.uid;
    },
    id() {
        if (this.id)
            return this.id;
        else
            return this.uid;
    },
    name() {
        return this._name;
    },
    isAsync() {
        return this.isAsync;
    },
    isAwaiting() {
        return !!this.isAwaiting;
    },
};
const applyValue = (a, f) => (!a.isEmpty ? (f(a.value, a), true) : false);
exports.handlers = {
    up(f) {
        this.children.add(f);
        applyValue(this._, f);
        return this._;
    },
    down(f) {
        if (this.children.has(f))
            this.children.delete(f);
        else if (this.grandChildren && this.grandChildren.has(f))
            this.grandChildren.delete(f);
        return this._;
    },
    clear() {
        delete this.value;
        this.children.clear();
        this.grandChildren && this.grandChildren.clear();
        this.stateListeners && this.stateListeners.clear();
        this.haveFrom && delete this.haveFrom;
        return this._;
    },
    decay() {
        this._.clear();
        utils_1.deleteParams(this);
    },
    clearValue() {
        state_1.notifyStateListeners(this, 'empty');
        delete this.value;
        return this._;
    },
    onAwait(fun) {
        state_1.addStateEventListener(this, state_1.FState.AWAIT, fun);
    },
    offAwait(fun) {
        state_1.removeStateEventListener(this, state_1.FState.AWAIT, fun);
    },
    resend() {
        core_1.notifyChildes(this);
        return this._;
    },
    next(f) {
        this.children.add(f);
        return this._;
    },
    once(f) {
        if (!applyValue(this._, f)) {
            const once = v => {
                this.children.delete(once);
                console.log(this.children.has(once));
                f(v);
            };
            this.children.add(once);
        }
        return this._;
    },
    is(value) {
        if (!this._.isEmpty) {
            return this.value === value;
        }
        else {
            return value === undefined;
        }
    },
    upSome(fun) {
        core_1.grandUpFn(this, fun, utils_1.someFilter);
        return this._;
    },
    upTrue(fun) {
        core_1.grandUpFn(this, fun, utils_1.trueFilter);
        return this._;
    },
    upFalse(fun) {
        core_1.grandUpFn(this, fun, utils_1.falseFilter);
        return this._;
    },
    upSomeFalse(fun) {
        core_1.grandUpFn(this, fun, utils_1.someFalseFilter);
        return this._;
    },
    upNone(fun) {
        core_1.grandUpFn(this, fun, utils_1.noneFilter);
        return this._;
    },
    setId(id) {
        this.id = id;
        return this._;
    },
    setName(value) {
        this._name = value;
        Object.defineProperty(this, "name", { value });
        return this._;
    },
    // apply(context, v) {
    //   this.bind(context)
    //   setAtomValue(this, v[0])
    // },
    addMeta(metaName, value) {
        if (!this.metaMap)
            this.metaMap = new Map();
        this.metaMap.set(metaName, value ? value : null);
        return this._;
    },
    hasMeta(metaName) {
        if (!this.metaMap)
            return false;
        return this.metaMap.has(metaName);
    },
    getMeta(metaName) {
        if (!this.metaMap)
            return null;
        return this.metaMap.get(metaName);
    },
    // on(stateEvent, fn) {
    //   addStateEventListener(this, stateEvent, fn)
    //   return this._
    // },
    // off(stateEvent, fn) {
    //   removeStateEventListener(this, stateEvent, fn)
    //   return this._
    // },
    useGetter(getterFunction, isAsync) {
        this.getterFn = getterFunction;
        this.isAsync = isAsync;
        return this._;
    },
    useOnceGet(getterFunction, isAsync) {
        this.getterFn = () => {
            delete this.getterFn;
            delete this.isAsync;
            return getterFunction();
        };
        this.isAsync = isAsync;
        return this._;
    },
    useWrapper(wrapperFunction, isAsync) {
        this.wrapperFn = wrapperFunction;
        this.isAsync = isAsync;
        return this._;
    },
    fmap(fun) {
        const v = fun(this.value);
        const context = core_1.debug.enabled ? [utils_1.AtomContext.fmap, fun.name()] : undefined;
        core_1.setAtomValue(this, v, context);
        return this._;
    },
    injectOnce(o, key) {
        if (!key) {
            key = this._name ? this._name : this.id ? this.id : this.uid;
        }
        if (!o)
            throw 'trying inject atom to null object';
        o[key] = this.value;
        return this._;
    },
    cloneValue() {
        return JSON.parse(JSON.stringify(this.value));
    },
};
