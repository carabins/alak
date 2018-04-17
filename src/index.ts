import {deleteParams, remove} from "./utils";
import {patternMatch} from "./match";


export interface IAFlow<T extends any> {
  (...a: T[]): T

  v: T
  data: T[]

  on(fn: Listener<T>): IAFlow<T>

  weakOn(fn: Listener<T>): IAFlow<T>

  off(fn: Listener<T>): IAFlow<T>

  stateless(v?: boolean): IAFlow<T>

  emitter(v?: boolean): IAFlow<T>

  end(): void

  emit(): void

  match(...pattern)

  mutate(fn: Listener<T>): T

  branch<U>(fn: (...a: any[]) => U[]): IAFlow<U>

  stop(fn): void

  drop(): void

  inject(obj: any, key?: string): void

  reject(obj): void


}


/**
 * Create new channel
 */
export default function AFlow<T>(...a: T[]): IAFlow<T> {
  type Fn = Listener<T>
  let listeners = []
  let state = true
  let emitter = false
  let mapObjects: any //Map<any, Function>
  let weakListeners = new WeakMap()
  let weakUid = []
  let proxy = {
    data: [],
    on: (fn: Fn) => {
      listeners.push([fn, fn])
      if (proxy.data.length > 0)
        fn.apply(fn, proxy.data)
    },
    curryOn: function (fn: Fn) {
      listeners.push([this, fn])
      if (proxy.data.length > 0)
        fn.apply(this, proxy.data)
    },
    weakOn: (where, f: Fn) => {
      let ws = new WeakSet()
      ws.add(where)
      weakListeners.set(where, f)
      weakUid.push(ws)
      if (proxy.data.length > 0)
        f.apply(f, proxy.data)
    },
    end: () => {
      deleteParams(functor)
      deleteParams(proxy)
      listeners = null
      proxy = null
    },
    emit: () => {
      listeners.forEach(f => f[1].apply(f[0], proxy.data))
    },
    mutate: function (fn: Fn) {
      let newValue

      if (proxy.data.length > 1) {
        newValue = fn.apply(this, proxy.data)
        setValues(newValue)
      } else {
        newValue = fn.apply(this, [getValue()])
        setValues([newValue])
      }
    },
    match: function () {
      proxy.on(A.match(arguments))
    },
    drop: () => listeners = [],
    stop(fn) {
      remove(listeners, fn)
    },
    branch(f) {
      let newCn = AFlow()
      proxy.on((...v) => newCn(...f(...v)))
      return newCn
    },
    inject(obj?: any, key?: string) {
      if (!obj) obj = {}
      if (!mapObjects) mapObjects = new Map<any, Function>()
      let fn = key
        ? v => obj[key] = v
        : v => Object.keys(v).forEach(k => obj[k] = v[k])
      mapObjects.set(obj, fn)
      proxy.on(fn)
      return obj
    },
    reject(obj) {
      if (mapObjects.has(obj)) {
        proxy.stop(mapObjects.get(obj))
        mapObjects.delete(obj)
      }
    },
    stateless(on = true) {

      state = !on
      return this
    },
    emitter(on = true) {
      emitter = on
      return this
    }
  }

  const getValue = () => {
    return proxy.data ? proxy.data.length > 1 ? proxy.data : proxy.data[0] : null
  }
  const setValues = v => {
    if (v.length > 0 || emitter) {
      if (state) {
        functor['data'] = proxy.data = v
        functor['v'] = v ? v.length > 1 ? v : v[0] : null
      }
      if (emitter && !v) v = true
      listeners.forEach(f => f[1].apply(f[0], v))
      if (weakUid.length) {
        weakUid.forEach(uid => {
          if (weakListeners.has(uid)) {
            let f = weakListeners.get(uid)
            f.apply(f, v)
          }
        })
      }

    }
  }

  function functor(...a) {
    if (!proxy) {
      console.error("emit ended channel: " + a)
      return
    }
    setValues(Object.values(arguments))
    return getValue()
  }

  let v = Object.values(arguments)
  setValues(v)


  Object.assign(proxy, {
    off: proxy.stop,
  })
  Object.assign(functor, proxy)
  return functor as any as IAFlow<T>
}


export class AFlowInjectable {
  mapObjects: Map<any, Function>

  inject(obj?) {
    if (!obj) obj = {}
    if (!this.mapObjects) this.mapObjects = new Map<any, Function>()
    Object.keys(this).forEach(k => {
      let f = this[k]
      if (f.on) {
        obj[k] = f.data[0]
        let fn = v => obj[k] = v
        f.on(fn)
        this.mapObjects.set(obj, fn)
      }
    })
    return obj
  }

  to(obj) {
    Object.keys(this).forEach(k => {
      let flow = this[k]
      if (flow.on) {
        flow.on(obj[k])
      }
    })
  }

  from(obj) {
    Object.keys(this).forEach(k => {
      let flow = obj[k]
      if (flow.on) {
        flow.on(this[k])
      }
    })
  }
}


export const A = {
  start: AFlow,
  flow: AFlow,
  stateless: () => AFlow().stateless(true),
  emitter: (...ar) => AFlow(...ar).emitter(true),
  mix(...ar) {
    let newStream = AFlow()
    let active = new Map()
    const emit = () => {
      if (active.size == ar.length)
        newStream(Array.from(active.values()))
    }

    ar.forEach(
      stream => {
        stream.on(
          data => {
            active.set(stream, data)
            emit()
          }
        )
      }
    )
    return newStream
  },
  match: patternMatch
}

export const DFlow = AFlow

export type Listener<T extends any> = (...a: T[]) => any
type TypeFN<T> = (...a: any[]) => T