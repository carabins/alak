import { grandUpFn, notifyListeners, setNucleonValue } from './quark'
import { addEventListener, ClearState, dispatchEvent, QState, removeEventListener } from './events'
import {
  deleteParams,
  falseFilter,
  noneFilter,
  someFalseFilter,
  someFilter,
  trueFilter,
  upDownFilter,
} from './utils'
import { from } from './computed'

const valueProp = 'value'

export const props = {
  isEmpty() {
    return !this.hasOwnProperty(valueProp)
  },
  isFilled() {
    return this.hasOwnProperty(valueProp)
  },
  haveListeners() {
    return this.listeners.size > 0
  },
  [Symbol.toPrimitive]() {
    return this._.toString()
  },
}

const applyValue = (q, f) =>
  q.hasOwnProperty(valueProp) ? (q.isHoly ? f.call(f, ...q.value) : f(q.value, q), true) : false

export const handlers: any = {
  up(f) {
    // console.log(':::: Up', f)
    this.listeners.add(f)
    applyValue(this._, f)
    return this._
  },
  down(f) {
    if (this.listeners.has(f)) this.listeners.delete(f)
    else if (this.grandListeners && this.grandListeners.has(f)) this.grandListeners.delete(f)
    return this._
  },
  silent(value) {
    this.value = value
    return this._
  },
  curry() {
    const ctx = this
    return function (v) {
      setNucleonValue(ctx, v)
    }
  },
  decay(silent) {
    !silent && dispatchEvent(this, QState.CLEAR, ClearState.DECAY)
    this.listeners.clear()
    this.grandListeners && this.grandListeners.clear()
    this.stateListeners && this.stateListeners.clear()
    this.haveFrom && delete this.haveFrom
    delete this.value
    this.risen && this.risen.forEach((f) => f())
    deleteParams(this)
  },
  clearValue() {
    dispatchEvent(this, QState.CLEAR, ClearState.VALUE)
    delete this.value
    return this._
  },

  resend() {
    notifyListeners(this)
    return this._
  },

  mutate(mutator) {
    this.value = mutator(this.value)
    notifyListeners(this)
    return this._
  },
  next(f) {
    this.listeners.add(f)
    return this._
  },
  once(f) {
    if (!applyValue(this._, f)) {
      const once = (v) => {
        this.listeners.delete(once)
        f(v)
      }
      this.listeners.add(once)
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

  parentFor(nucleon: INucleus<any>, name) {
    let parents = nucleon.getMeta('parents')
    if (!parents) {
      parents = {}
      nucleon.addMeta('parents', parents)
    }
    const trueName = name | 1
    const prevNucleon = parents[trueName]
    prevNucleon && prevNucleon.down(nucleon)
    parents[trueName] = this._
    this._.up(nucleon)
  },

  onClear(fun) {
    addEventListener(this, QState.CLEAR, fun)
  },
  offClear(fun) {
    removeEventListener(this, QState.CLEAR, fun)
  },
  onAwait(fun) {
    addEventListener(this, QState.AWAIT, fun)
  },
  offAwait(fun) {
    removeEventListener(this, QState.AWAIT, fun)
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

  finite(v?) {
    if (v == undefined) this.isFinite = true
    else this.isFinite = v
    return this._
  },
  holistic(v?) {
    if (v == undefined) this.isHoly = true
    else this.isHoly = v
    return this._
  },
  stateless(v) {
    if (v == undefined) this.isStateless = true
    else this.isStateless = v
    if (this.isStateless) this._.clearValue()
    return this._
  },
  bind(context) {
    if (this._context != context) {
      this._context = context
      this.bind(context)
    }
  },
  apply(context, v) {
    this.bind(context)
    setNucleonValue(this, v[0])
  },
  call(context, ...v) {
    this._(...v)
  },
  addMeta(metaName, value?) {
    if (!this.metaMap) this.metaMap = new Map<string, any>()
    this.metaMap.set(metaName, value ? value : null)
    return this._
  },
  deleteMeta(metaName) {
    if (!this.metaMap) return false
    return this.metaMap.delete(metaName)
  },
  hasMeta(metaName) {
    if (!this.metaMap) return false
    return this.metaMap.has(metaName)
  },
  getMeta(metaName) {
    if (!this.metaMap) return null
    return this.metaMap.get(metaName)
  },
  dispatch(event, ...value) {
    dispatchEvent(this, event, ...value)
    return this._
  },
  on(stateEvent, fn) {
    addEventListener(this, stateEvent, fn)
    return this._
  },
  off(stateEvent, fn) {
    removeEventListener(this, stateEvent, fn)
    return this._
  },
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

  tuneTo(a: INucleus<any>) {
    this.tuneOff()
    this.tunedTarget = a
    a.up(this._)
  },
  tuneOff() {
    this.tunedTarget && this.tunedTarget.down(this.tunedTarget)
  },

  injectTo(o, key) {
    if (!key) {
      key = this._name ? this._name : this.id ? this.id : this.uid
    }
    if (!o) throw 'trying inject quark to null object'
    o[key] = this.value
    return this._
  },
  cloneValue() {
    return JSON.parse(JSON.stringify(this.value))
  },

  [Symbol.toPrimitive]() {
    this._.toString()
  },
  [Symbol.dispose]() {
    this._.decay()
  },
  toString() {
    return `nucleon:${this._.uid}`
  },
  valueOf() {
    return `nucleon:${this._.uid}`
  },
  from,
}
