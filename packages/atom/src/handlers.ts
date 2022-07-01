// @ts-nocheck
import { grandUpFn, notifyChildes, setAtomValue } from './core'
import {
  addStateEventListener,
  ClearState,
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
  trueFilter,
  upDownFilter,
} from './utils'
import { from } from './computed'
import { createAtom } from './create'

const valueProp = 'value'

export const coreProps = {
  isEmpty: {
    get() {
      return !this.hasOwnProperty(valueProp)
    },
  },
  cast: {
    get() {
      return this._
    },
  },
}

export const proxyProps = {
  // apply(context, v) {
  // },
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
  isFiniteLoop() {
    return this.isSafe
  },
  isSafe() {
    return this.isSafe
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

  parents() {
    return this._.parents ? this._.parents : []
  },
}

const applyValue = (a, f) =>
  a.isEmpty ? false : (a.isHoly ? f.call(f, ...a.value) : f(a.value, a), true)

export const handlers: any = {
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
  silent(value) {
    this.value = value
    return this._
  },
  curry(context) {
    const ctx = this
    return function (v) {
      setAtomValue(ctx, v, context || AtomContext.currying)
    }
  },
  clearListeners(silent) {
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
    this.decays && this.decays.forEach((f) => f())
    deleteParams(this)
  },
  clearValue() {
    notifyStateListeners(this, FState.CLEAR, ClearState.VALUE)
    delete this.value
    return this._
  },

  parentFor(atom: IAtom<any>, name) {
    let parents = atom.getMeta('parents')
    if (!parents) {
      parents = {}
      atom.addMeta('parents', parents)
    }
    const trueName = name | 1
    const prevAtom = parents[trueName]
    prevAtom && prevAtom.down(atom)
    parents[trueName] = this._
    this._.up(atom)
  },
  link(link, f) {
    this._.up(f)
    if (!this.links) this.links = new Map<any, any>()
    this.links.set(link, f)
    return this._
  },

  downLink(linkObject: any) {
    const links: Map<any, any> = this.links as Map<any, any>
    if (links && links.has(linkObject)) {
      this._.down(links.get(linkObject))
      links.delete(linkObject)
    }
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
  emit() {
    this.resend()
    return this._
  },
  next(f) {
    this.children.add(f)
    return this._
  },
  once(f) {
    if (!applyValue(this._, f)) {
      const once = (v) => {
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
  safe(v?) {
    if (v == undefined) this.isSafe = true
    else this.isSafe = v
    return this._
  },
  setFiniteLoop(v) {
    this.safe(v)
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
    setAtomValue(this, v[0])
  },
  call(context, ...v) {
    this._(...v)
  },
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
  dispatch(event, ...value) {
    notifyStateListeners(this, event, ...value)
    return this._
  },
  on(stateEvent, fn) {
    addStateEventListener(this, stateEvent, fn)
    return this._
  },
  off(stateEvent, fn) {
    removeStateEventListener(this, stateEvent, fn)
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
  fmap(fun, context?) {
    const v = fun(this.value)
    setAtomValue(this, v, context)
    return this._
  },

  mix(...a) {
    return this.fmap(...a)
  },
  boxMerge(array, key = 'id', context = 'boxJoin') {
    const v = this.value || {}
    array.forEach((i) => (v[i[key]] = i))
    setAtomValue(this, v, context)
    return this._
  },
  boxAssign(object, context = 'boxAssign') {
    const v = this.value || {}
    setAtomValue(this, Object.assign(v, object), context)
    return this._
  },
  boxGet(key) {
    if (this.value) {
      return this.value[key]
    } else {
      return undefined
    }
  },
  boxDelete(key) {
    const v = this.value || {}
    delete v[key]
    return this._
  },
  boxUpdate(key, value, context = 'boxAdd') {
    const v = this.value || {}
    v[key] = value
    setAtomValue(this, v, context)
    return this._
  },

  boxSet(key, value, context = 'boxAdd') {
    const v = this.value || {}
    v[key] = value
    setAtomValue(this, v, context)
    return this._
  },
  boxEach(fun) {
    this.value && Object.values(this.value).forEach(fun)
    return this._
  },
  unboxToMap(fun) {
    return this.value ? Object.keys(this.value).map(fun) : {}
  },
  unboxToList() {
    return this.value ? Object.values(this.value) : []
  },
  boxMap(fun) {
    const a = createAtom()
    this.up((v) => a(this.unboxToMap(fun), this._))
    return a
  },
  boxToList() {
    const a = createAtom()
    this.up((v) => a(this.unboxToList(), this._))
    return a
  },

  tuneTo(a: IAtom<any>) {
    this.tuneOff()
    this.tunedTarget = a
    a.up(this._)
  },

  tuneOff() {
    this.tunedTarget && this.tunedTarget.down(this.tunedTarget)
  },

  listSize() {
    return this.value?.length
  },
  listAdd(value, context = 'listAdd') {
    this.value.push(value)
    setAtomValue(this, this.value, context)
    return this._
  },
  listMerge(list, context = 'listMerge') {
    this.value.push(...list)
    setAtomValue(this, this.value, context)
  },
  listMap(fun) {
    const a = createAtom()
    this.up((v) => a(v.map(fun), this._))
    return a
  },
  listToBox(key) {
    const a = createAtom()
    this.up((v) => a.boxMerge(v, key, this._))
    return a
  },

  injectTo(o, key) {
    if (!key) {
      key = this._name ? this._name : this.id ? this.id : this.uid
    }
    if (!o) throw 'trying inject core to null object'
    o[key] = this.value
    return this._
  },
  cloneValue() {
    return JSON.parse(JSON.stringify(this.value))
  },

  [Symbol.toPrimitive]() {
    this.toString()
  },
  toString() {
    return `atom:${this._.uid}`
  },
  valueOf() {
    return `atom:${this._.uid}`
  },
  from,
  isAtom: () => true,
}
