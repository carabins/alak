import { ActiveUnions, UnionNamespaces } from 'alak/namespaces'

export { alakFactory, alakModel } from 'alak/model'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, savedAtom } from '@alaq/atom/index'
export { saved, stateless, rune } from '@alaq/atom/property'
import { storage } from '@alaq/atom/storage'

import { Nucleus, N, QuarkEventBus } from '@alaq/nucleus/index'

export const NucleusStorage = storage
export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}

export declare abstract class UnionModel<NS extends keyof ActiveUnions> {
  _: ActiveUnions[NS]['facade']
  __: {
    namespace: string
    modelName: string
  }
}

export abstract class UnionMultiModel<NS extends keyof ActiveUnions> {
  _: ActiveUnions[NS]['facade']
  __: {
    namespace: string
    modelName: string
    id: string | number
    data?: any
  }
}
