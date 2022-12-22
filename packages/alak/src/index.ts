export { atomicFactory, atomicModel } from 'alak/atomicModel'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, eternalAtom } from '@alaq/atom/index'
export { eternal, flighty } from '@alaq/atom/property'

import { Nucleus, QuarkEventBus } from '@alaq/nucleus/index'

export class ActiveCluster {
  atoms = {} as Record<string, AtomicNode<any>>
  eventBus = Nucleus.holistic().stateless()
  bus = QuarkEventBus()
  public constructor(public namespace: string) {}
}

const activeClusters = {}

export function getAtomCluster(id: string = 'cluster'): ActiveCluster {
  let cluster = activeClusters[id]
  if (!cluster) {
    cluster = activeClusters[id] = new ActiveCluster(id)
  }
  return cluster
}

export abstract class AtomicModel {
  _: {
    id: any
    name: string
    target: any
    core: Record<string, INucleon<any>>
    cluster: Record<string, AtomicNode<any>>
    dispatchEvent(name: ClusterEvents, data?): void
    set(atom: string, nuclon: string, data: any): void
    get(atom: string, nuclon): void
    call(atom: string, methodName: string, args?: any[])
  }
}
