import { createCore } from './core'
import { coreProps, handlers, proxyProps } from './handlers'

import { DECAY_ATOM_ERROR, PROPERTY_ATOM_ERROR } from './utils'
import debug, { proxyDebugHandler } from './debug'

let protoHandlers
function makeProtoHandlers() {
  protoHandlers = Object.defineProperties(Object.assign({}, handlers), coreProps)
}
makeProtoHandlers()
/**
 * Установить расширения атома
 * @param options - {@link ExtensionOptions}
 */
export function installAtomExtension(options) {
  options.handlers && Object.assign(handlers, options.handlers)
  makeProtoHandlers()
}

function get(core: Core, prop: string, receiver: any): any {
  if (!core.children) {
    throw DECAY_ATOM_ERROR
  }
  let keyFn = handlers[prop]
  if (keyFn) return keyFn.bind(core)
  keyFn = proxyProps[prop]
  if (keyFn) return keyFn.call(core)
  throw PROPERTY_ATOM_ERROR
}

export function createAtom<T>(value?: T) {
  const core = createCore(...arguments)
  core.__proto__ = protoHandlers
  // if (debug.enabled) {
  //   let _ = new Proxy(core, proxyDebugHandler)
  //   core._ = _
  //   return _
  // }
  core._ = core
  return debug.enabled ? new Proxy(core, proxyDebugHandler) : core
}
