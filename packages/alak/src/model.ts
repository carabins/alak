/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { proxyAtom } from './proxyAtom'
import { QuarkEventBus } from '@alaq/nucleus/index'

export function alakModel<M, E extends object, N>(constructor: IAlakConstructor<M, E, N>) {
  return proxyAtom(constructor) as IAlakAtom<M, E>
}

export function alakFactory<M, E extends object, N>(constructor: IAlakConstructor<M, E, N>) {
  const nodes = {}
  const bus = QuarkEventBus(constructor.name)
  const multiCore = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as IAlakAtom<M, E>['core']
  return {
    get(id, target?) {
      let actomicFactory = nodes[id] as IAlakAtom<any, any>
      if (!actomicFactory) {
        actomicFactory = nodes[id] = proxyAtom(constructor, id, target)
        bus.addBus(actomicFactory.bus)
      }
      return actomicFactory as IAlakAtom<M, E>
    },
    delete(id) {
      bus.removeBus(nodes[id].bus)
      delete nodes[id]
    },
    multiCore,
    bus,
  } as IAlakAtomFactory<M, E>
}
