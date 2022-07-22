/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { proxyAtom } from './proxyAtom'

export function atomicNode<M, E, N>(constructor: AtomicConstructor<M, E, N>) {
  return proxyAtom(constructor) as AtomicNode<M>
}

export function atomicNodes<M, E, N>(constructor: AtomicConstructor<M, E, N>) {
  const nodes = {}

  const broadCast = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol, receiver: any): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as AtomicNode<M>['core']
  const mole = {} as any
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
