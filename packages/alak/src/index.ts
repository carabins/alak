// export { alakFactory, alakModel } from 'alak/alakModel'
// export { alakMolecule } from 'alak/molecule'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, storedAtom } from '@alaq/atom/index'
export { stored, stateless, traced } from '@alaq/atom/property'
export { storage } from '@alaq/atom/storage'

import { Nucleus, QuarkEventBus } from '@alaq/nucleus/index'

export class ActiveCluster {
  atoms = {} as Record<string, ANode<any>>
  bus: QuarkBus<string, any>

  public constructor(public namespace: string) {
    this.bus = QuarkEventBus(namespace)
  }
}

const activeClusters = {}

export function activeCluster(id: string = 'cluster'): ActiveCluster {
  let cluster = activeClusters[id]
  if (!cluster) {
    cluster = activeClusters[id] = new ActiveCluster(id)
  }
  return cluster
}

export abstract class AlakModel {
  _: {
    id: any
    name: string
    target: any
    core: Record<string, INucleon<any>>
    cluster: Record<string, ANode<any>>
    dispatchEvent(name: ClusterEvents, data?): void
    set(atom: string, nucleus: string, data: any): void
    get(atom: string, nucleus: string): void
    call(atom: string, methodName: string, args?: any[])
  }
}
