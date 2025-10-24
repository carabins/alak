import type { ActiveUnions, CurrentNamespace } from './namespaces'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus/index'
export { nucleonExtensions } from '@alaq/nucleus/create'
export { Atom, savedAtom } from '@alaq/atom/index'
export { saved, stateless, tag, mixed } from '@alaq/atom/property'

export type { UnionNamespaces, CurrentNamespace } from './namespaces'

export { UnionConstructor } from 'alak/UnionConstructor'
export { GetUnionCore } from 'alak/UnionCore'
export { UnionAtom, UnionAtomFactory } from 'alak/unionAtom'
// export { extendUnion, createExtendableStore } from 'alak/unionBuilder'

import { storage } from '@alaq/atom/storage'

import { Nucleus, N, QuarkEventBus } from '@alaq/nucleus/index'

export { injectFacade } from 'alak/facadeInjector'
export { Q, QRealm } from 'alak/inject'

export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}

export type IUFacade<NS extends keyof ActiveUnions> = ActiveUnions[NS]['facade']

export abstract class UnionModel<NS extends keyof ActiveUnions = CurrentNamespace> {
  $: Atomized<PureModel<this>>
  _: ActiveUnions[NS]['facade']
  _modelNamespace?: string
  _modelName?: string
}

export abstract class UnionMultiModel<NS extends keyof ActiveUnions = CurrentNamespace> extends UnionModel<NS> {
  _modelId?: string | number
  _modelData?: any
}
