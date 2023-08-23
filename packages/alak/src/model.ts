/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import { proxyAtom } from './proxyAtom'
import { QuarkEventBus } from '@alaq/nucleus/index'

export function alakModel<M, E, N>(constructor: AlakConstructor<M, E, N>) {
  return proxyAtom(constructor) as AlakAtom<M>
}

export function alakFactory<M, E, N>(constructor: AlakConstructor<M, E, N>) {
  const nodes = {}
  const bus = QuarkEventBus(constructor.name)
  const multiCore = new Proxy(
    {},
    {
      get(target: {}, p: string | symbol): any {
        return (v) => Object.values(nodes).forEach((n) => n[p](v))
      },
    },
  ) as AlakAtom<M>['core']
  return {
    get(id, target?) {
      let npa = nodes[id] as AlakAtom<any>
      if (!npa) {
        npa = nodes[id] = proxyAtom(constructor, id, target)
        bus.addBus(npa.bus)
      }
      return npa as AlakAtom<M>
    },
    delete(id) {
      bus.removeBus(nodes[id].bus)
      delete nodes[id]
    },
    multiCore,
    bus,
  } as {
    get(id: string, target: any): AlakAtom<M>
    delete(id: string): void
    multiCore: ModelCore<M>
    bus: QuarkBus<string, any>
  }
}
