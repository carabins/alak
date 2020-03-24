import { debug, grandUpFn, notifyChildes, setAtomValue } from './core'
import {
  addStateEventListener, ClearState,
  FState,
  notifyStateListeners,
  removeStateEventListener,
} from './state'
import {
  alive,
  AtomContext,
  deleteParams,
  falseFilter,
  noneFilter,
  someFalseFilter,
  someFilter,
  trueFilter, upDownFilter,
} from './utils'

const valueProp = 'value'

export const coreProps = {
  isEmpty: {
    get() {
      return !this.hasOwnProperty(valueProp)
    },
  },
  // id: {
  //   get() {
  //     if (this._id) return this._id
  //     else return this.uid
  //   },
  // },
  // name: {
  //   get() {
  //     return this._name
  //   },
  // },
}

export const proxyProps = {
  value() {
    return this.value
  },
  isEmpty() {
    return !this.hasOwnProperty(valueProp)
  },
  uid() {
    return this.uid
  },
  id() {
    if (this.id) return this.id
    else return this.uid
  },
  name() {
    return this._name
  },
  isAsync() {
    return this.isAsync
  },
  isAwaiting() {
    return !!this.isAwaiting
  },
  isStateless() {
    return !!this.isStateless
  },
}

const applyValue = (a, f) => a.isEmpty ? false :
  (a.isFlow ? f.call(f, ...a.value) : f(a.value, a), true)

export const handlers = {
  up(f) {
    this.children.add(f)
    applyValue(this._, f)
    return this._
  },
  down(f) {
    if (this.children.has(f)) this.children.delete(f)
    else if (this.grandChildren && this.grandChildren.has(f)) this.grandChildren.delete(f)
    return this._
  },
  clear(silent) {
    !silent && notifyStateListeners(this, FState.CLEAR, ClearState.ALL)
    delete this.value
    this.children.clear()
    this.grandChildren && this.grandChildren.clear()
    this.stateListeners && this.stateListeners.clear()
    this.haveFrom && delete this.haveFrom
    return this._
  },
  decay() {
    notifyStateListeners(this, FState.CLEAR, ClearState.DECAY)
    this._.clear(true)
    deleteParams(this)
  },
  clearValue() {
    notifyStateListeners(this, FState.CLEAR, ClearState.VALUE)
    delete this.value
    return this._
  },
  onClear(fun) {
    addStateEventListener(this, FState.CLEAR, fun)
  },
  offClear(fun) {
    removeStateEventListener(this, FState.CLEAR, fun)
  },
  onAwait(fun) {
    addStateEventListener(this, FState.AWAIT, fun)
  },
  offAwait(fun) {
    removeStateEventListener(this, FState.AWAIT, fun)
  },
  resend() {
    notifyChildes(this)
    return this._
  },
  next(f) {
    this.children.add(f)
    return this._
  },
  once(f) {
    if (!applyValue(this._, f)) {
      const once = v => {
        this.children.delete(once)
        f(v)
      }
      this.children.add(once)
    }
    return this._
  },
  is(value) {
    if (!this._.isEmpty) {
      return this.value === value
    } else {
      return value === undefined
    }
  },
  upDown(fun) {
    grandUpFn(this, fun, upDownFilter(fun))
    return this._
  },
  upSome(fun) {
    grandUpFn(this, fun, someFilter)
    return this._
  },
  upTrue(fun) {
    grandUpFn(this, fun, trueFilter)
    return this._
  },
  upFalse(fun) {
    grandUpFn(this, fun, falseFilter)
    return this._
  },
  upSomeFalse(fun) {
    grandUpFn(this, fun, someFalseFilter)
    return this._
  },
  upNone(fun) {
    grandUpFn(this, fun, noneFilter)
    return this._
  },
  setId(id) {
    this.id = id
    return this._
  },
  setName(value) {
    this._name = value
    Object.defineProperty(this, 'name', { value })
    return this._
  },
  toFlow(v?) {
    if (v == undefined)
      this.isFlow = true
    else
      this.isFlow = v
    return this._
  },
  toStateless(v) {
    if (v == undefined)
      this.isStateless = true
    else
      this.isStateless = v
    if (this.isStateless)
      this._.clearValue()
    return this._
  },
  // apply(context, v) {
  //   this.bind(context)
  //   setAtomValue(this, v[0])
  // },
  addMeta(metaName, value?) {
    if (!this.metaMap) this.metaMap = new Map<string, any>()
    this.metaMap.set(metaName, value ? value : null)
    return this._
  },
  hasMeta(metaName) {
    if (!this.metaMap) return false
    return this.metaMap.has(metaName)
  },
  getMeta(metaName) {
    if (!this.metaMap) return null
    return this.metaMap.get(metaName)
  },
  // on(stateEvent, fn) {
  //   addStateEventListener(this, stateEvent, fn)
  //   return this._
  // },
  // off(stateEvent, fn) {
  //   removeStateEventListener(this, stateEvent, fn)
  //   return this._
  // },
  setGetter(getterFunction, isAsync) {
    this.getterFn = getterFunction
    this.isAsync = isAsync
    return this._
  },
  setOnceGet(getterFunction, isAsync) {
    this.getterFn = () => {
      delete this.getterFn
      delete this.isAsync
      return getterFunction()
    }
    this.isAsync = isAsync
    return this._
  },
  setWrapper(wrapperFunction, isAsync) {
    this.wrapperFn = wrapperFunction
    this.isAsync = isAsync
    return this._
  },
  fmap(fun) {
    const v = fun(this.value)
    const context = debug.enabled ? [AtomContext.fmap, fun.name()] : undefined
    setAtomValue(this, v, context)
    return this._
  },
  injectOnce(o, key) {
    if (!key) {
      key = this._name ? this._name : this.id ? this.id : this.uid
    }
    if (!o) throw 'trying inject atom to null object'
    o[key] = this.value
    return this._
  },
  cloneValue() {
    return JSON.parse(JSON.stringify(this.value))
  },
}
