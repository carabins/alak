/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { proxyAtom } from './proxyAtom'

export function atomicModel<M, E, N>(constructor: AtomicConstructor<M, E, N>) {
  return proxyAtom(constructor) as AtomicNode<M>
}

export function atomicFactory<M, E, N>(constructor: AtomicConstructor<M, E, N>) {
  const nodes = {}

  const broadCast = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as AtomicNode<M>['core']
  return {
    get(id, target?) {
      let npa = nodes[id]
      if (!npa) {
        npa = nodes[id] = proxyAtom(constructor, id, target)
      }
      return npa as AtomicNode<M>
    },
    delete(id) {
      delete nodes[id]
    },
    broadCast,
  }
}
