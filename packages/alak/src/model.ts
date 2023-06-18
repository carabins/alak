/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { proxyAtom } from './proxyAtom'

export function alakModel<M, E, N>(constructor: AlakConstructor<M, E, N>) {
  return proxyAtom(constructor) as ANode<M>
}

export function alakFactory<M, E, N>(constructor: AlakConstructor<M, E, N>) {
  const nodes = {}

  const broadCast = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as ANode<M>['core']
  return {
    get(id, target?) {
      let npa = nodes[id]
      if (!npa) {
        npa = nodes[id] = proxyAtom(constructor, id, target)
      }
      return npa as ANode<M>
    },
    delete(id) {
      delete nodes[id]
    },
    broadCast,
  }
}
