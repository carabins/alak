import { createCore } from './core'
import { coreProps, handlers, proxyProps } from './handlers'

import { DECAY_ATOM_ERROR, PROPERTY_ATOM_ERROR } from './utils'

let protoHandlers
function makeProtoHandlers() {
  protoHandlers = Object.defineProperties(Object.assign({}, handlers), coreProps)
}
makeProtoHandlers()
const proxyExtensions = []
/**
 * Установить расширения атома
 * @param options - {@link ExtensionOptions}
 */
export function installAtomExtension(options) {
  options.handlers && Object.assign(handlers, options.handlers)
  options.proxy && proxyExtensions.push(options.proxy)
  options.props && Object.assign(coreProps, options.props)
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
  let core = createCore(...arguments)
  core.__proto__ = protoHandlers
  core._ = core
  proxyExtensions.forEach((proxy) => (core = proxy(core)))
  return core
}
