export { alakFactory, alakModel } from 'alak/model'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, savedAtom } from '@alaq/atom/index'
export { saved, stateless, traced } from '@alaq/atom/property'
export {UnionFacade} from './namespaces'
import { storage } from '@alaq/atom/storage'

import { Nucleus, N, QuarkEventBus } from '@alaq/nucleus/index'

export const NucleusStorage = storage
export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}

export abstract class AlakModel {
  _: {
    id: any
    name: string
    target: any
    core: Record<string, INucleus<any>>
    cluster: Record<string, AlakAtom<any>>
    dispatchEvent(name: string, data?): void
    set(atom: string, nucleus: string, data: any): void
    get(atom: string, nucleus: string): void
    call(atom: string, methodName: string, args?: any[])
  }
}
