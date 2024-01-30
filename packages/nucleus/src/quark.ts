import { dispatchEvent, QState } from './events'
import { rnd } from './utils'

export function setNucleonValue(quark: Quark, value?) {
  const setValue = (finalValue) => {
    if (quark.wrapperFn) {
      const wrappedValue = quark.wrapperFn(finalValue, quark.value)
      if (wrappedValue && wrappedValue.then) {
        return setAsyncValue(quark, wrappedValue)
      }
      finalValue = wrappedValue
    }

    if (quark.isSafe && quark.value == finalValue) {
      return
    }
    quark.prev = quark.value
    quark.value = finalValue
    notifyListeners(quark)
    if (quark.isStateless) delete quark.value
    delete quark.prev
    return finalValue
  }
  if (value && value.then) {
    return setAsyncValue(quark, value)
  }
  return setValue(value)
}

async function setAsyncValue(quark: Quark, promise: PromiseLike<any>) {
  dispatchEvent(quark, QState.AWAIT, true)
  quark.isAwaiting = promise
  quark.isAsync = true
  const v = await promise
  if (quark.isSafe && quark.value == v) {
    return
  }
  quark.prev = quark.value
  quark.value = v
  quark.isAwaiting = false
  dispatchEvent(quark, QState.AWAIT, false)
  notifyListeners(quark)
  if (quark.isStateless) delete quark.value
  delete quark.prev
  return v
}

export function notifyListeners(quark: Quark) {
  const v = quark.value
  const apply = quark.isHoly ? (f) => f(...v) : (f) => (f.length == 2 ? f(v, quark._) : f(v))
  quark.listeners.size > 0 && quark.listeners.forEach(apply)
  quark.grandListeners && quark.grandListeners.size > 0 && quark.grandListeners.forEach(apply)
}

export function grandUpFn(quark: Quark, keyFun: AnyFunction, grandFun: AnyFunction): any {
  if (!quark.grandListeners) quark.grandListeners = new Map()
  const grandUpFun = grandFun(keyFun.bind(quark._))
  quark.grandListeners.set(keyFun, grandUpFun)
  !quark._.isEmpty && grandUpFun(quark.value)
}

export const createQuark = (...a) => {
  const quark = function (...v) {
    if (v.length) {
      const value = quark.isHoly ? v : v[0]
      return setNucleonValue(quark, value)
    } else {
      if (quark.isStateless) {
        notifyListeners(quark)
        return
      }
      if (quark.isAwaiting) {
        return quark.isAwaiting
      }
      if (quark.getterFn) {
        return setNucleonValue(quark, quark.getterFn())
      }
      return quark.value
    }
  } as Quark
  quark.listeners = new Set<AnyFunction>()
  quark.uid = rnd()
  a.length && quark(...a)
  return quark as any
}
