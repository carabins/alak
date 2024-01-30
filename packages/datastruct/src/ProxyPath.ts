import { getBindingIdentifiers } from '@babel/types'
import keys = getBindingIdentifiers.keys

const pathHandlers = {
  apply(o) {
    let p = o.parent
    const fullPath = []
    fullPath.push(o.key)
    while (p.parent) {
      fullPath.push(p.key)
      p = p.parent
    }
    return fullPath.reverse()
  },
  get(o, k) {
    let p = o.keys[k]
    if (!p) {
      p = o.keys[k] = proxyPath(o, k)
    }
    return p
  },
}

function newPathNote(parent?, key?) {
  function pN() {}

  pN.parent = parent
  pN.key = key

  pN.keys = {}
  return pN as any
}

function proxyPath(o, key) {
  return new Proxy(newPathNote(o, key), pathHandlers)
}

export default function ProxyPath() {
  return new Proxy(newPathNote(), pathHandlers)
}
