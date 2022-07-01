import { FState, notifyStateListeners } from './state'
import { AtomContext, DECAY_ATOM_ERROR, rnd } from './utils'
import debug from './debug'

export function setAtomValue(core: Core, value, context?) {
  const setValue = (finalValue) => {
    if (core.wrapperFn) {
      const wrappedValue = core.wrapperFn(finalValue, core.value)
      if (wrappedValue && wrappedValue.then) {
        debug.enabled && debug.updateAsyncStart(core, context)
        return setAsyncValue(core, wrappedValue)
      }
      finalValue = wrappedValue
    }

    if (core.isSafe && core.value == finalValue) {
      return
    }
    core.prev = core.value
    core.value = finalValue
    debug.enabled && debug.updateValue(core, context)
    notifyChildes(core)
    if (core.isStateless) delete core.value
    delete core.prev
    return finalValue
  }
  if (value && value.then) {
    return setAsyncValue(core, value)
  }
  return setValue(value)
}

async function setAsyncValue(core: Core, promise: PromiseLike<any>) {
  notifyStateListeners(core, FState.AWAIT, true)
  core.isAwaiting = promise
  core.isAsync = true
  const v = await promise
  if (core.isSafe && core.value == v) {
    return
  }
  core.prev = core.value
  core.value = v
  core.isAwaiting = false
  notifyStateListeners(core, FState.AWAIT, false)
  debug.enabled && debug.updateAsyncFinish(core)
  notifyChildes(core)
  if (core.isStateless) delete core.value
  delete core.prev
  return v
}

export function notifyChildes(core: Core) {
  const v = core.value
  const apply = core.isHoly ? (f) => f(...v) : (f) => (f.length == 2 ? f(v, core._) : f(v))
  core.children.size > 0 && core.children.forEach(apply)
  core.grandChildren && core.grandChildren.size > 0 && core.grandChildren.forEach(apply)
}

export function grandUpFn(core: Core, keyFun: AnyFunction, grandFun: AnyFunction): any {
  if (!core.grandChildren) core.grandChildren = new Map()
  const grandUpFun = grandFun(keyFun.bind(core._))
  core.grandChildren.set(keyFun, grandUpFun)
  !core._.isEmpty && grandUpFun(core.value)
}

export const createCore = (...a) => {
  const core = function (...v) {
    if (!core.children) {
      throw DECAY_ATOM_ERROR
    }
    if (v.length) {
      const value = core.isHoly ? v : v[0]
      if (debug.enabled)
        return setAtomValue(core, value, !core.isHoly && v[1] ? v[1] : AtomContext.direct)
      else return setAtomValue(core, value)
    } else {
      if (core.isStateless) {
        notifyChildes(core)
        return
      }
      if (core.isAwaiting) {
        return core.isAwaiting
      }
      if (core.getterFn) {
        return setAtomValue(core, core.getterFn(), AtomContext.getter)
      }
      return core.value
    }
  } as Core
  core.children = new Set<AnyFunction>()
  core.uid = rnd()
  a.length && core(...a)
  return core as any
}
