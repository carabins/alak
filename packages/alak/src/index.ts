// export { alakFactory, alakModel } from 'alak/alakModel'
// export { alakMolecule } from 'alak/molecule'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, savedAtom } from '@alaq/atom/index'
export { saved, stateless, traced } from '@alaq/atom/property'
import { storage } from '@alaq/atom/storage'

import { Nucleus, N, QuarkEventBus } from '@alaq/nucleus/index'

export const NucleusStorage = storage
export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}

export class ActiveCluster {
  atoms = {} as Record<string, AlakAtom<any>>
  bus: QuarkBus<string, any>

  public constructor(public namespace: string) {
    this.bus = QuarkEventBus(namespace)
  }
}

const activeClusters = {}

export function injectCluster(name: string = 'cluster'): ActiveCluster {
  let cluster = activeClusters[name]
  if (!cluster) {
    cluster = activeClusters[name] = new ActiveCluster(name)
  }
  return cluster
}

export abstract class AlakModel {
  _: {
    id: any
    name: string
    target: any
    core: Record<string, INucleon<any>>
    cluster: Record<string, AlakAtom<any>>
    dispatchEvent(name: ClusterEvents, data?): void
    set(atom: string, nucleus: string, data: any): void
    get(atom: string, nucleus: string): void
    call(atom: string, methodName: string, args?: any[])
  }
}
