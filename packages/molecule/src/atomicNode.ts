/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { Atom } from '@alaq/atom/index'
import { Nucleus } from '@alaq/nucleus/index'
import { proxyAtom } from './proxyAtom'

export function atomicNode<M, E, N>(constructor: AtomicConstructor<M, E, N>) {
  return proxyAtom(constructor) as AtomicInstance<M, E, N>
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
  ) as AtomicInstance<M, E, N>['core']

  return {
    get(id, target?) {
      let npa = nodes[id]
      if (!npa) {
        npa = nodes[id] = proxyAtom(constructor, id, target)
      }
      return npa as AtomicInstance<M, E, N>
    },
    delete(id) {
      delete nodes[id]
    },
    broadCast,
  }
}
