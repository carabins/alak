import { createQuark } from './quark'
import { handlers, props } from './handlers'

const quant = {
  extensions: {} as Record<string, AnyFunction>,
}

/**
 * Установить расширения нуклона
 */
export function nucleonExtensions(...extensions: NucleonExtension[]) {
  extensions.forEach((ext) => {
    Object.assign(quant.extensions, ext)
  })
}

const proxy = {
  get(q, key) {
    const r = q[key]
    if (r || typeof r != 'undefined' || r != null) {
      return r
    }
    let f = quant.extensions[key] || props[key]
    if (f) {
      return f.apply(q)
    }
    f = handlers[key]
    if (f) {
      return (...a) => f.call(q, ...a)
    }
    return r
  },
}

export function createNucleus<T>(value?: T) {
  const quark = createQuark(...arguments)
  quark._ = new Proxy(quark, proxy)
  return quark._
}
