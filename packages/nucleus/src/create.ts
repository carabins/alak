import { createQuark } from './quark'
import { handlers, quarkProps } from './handlers'

const quaint = {
  proto: Object.defineProperties(Object.assign({}, handlers), quarkProps),
  proxy: {} as Record<string, AnyFunction>,
}

/**
 * Установить расширения нуклона
 */
export function nucleonExtensions(...extensions: NucleonExtension[]) {
  extensions.forEach((ext) => {
    Object.assign(quaint.proxy, ext)
  })
}

const proxy = {
  get(q, key) {
    const r = q[key]
    if (r || typeof r != 'undefined' || r != null) {
      return r
    }
    const f = quaint.proxy[key]
    if (f) {
      return f.apply(q)
    }
    return r
  },
}

export function createNucleon<T>(value?: T) {
  const quark = createQuark(...arguments)
  quark.__proto__ = quaint.proto
  quark._ = new Proxy(quark, proxy)
  return quark._
}
