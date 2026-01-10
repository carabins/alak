import type { ActiveUnions } from './namespaces'

export { N, Nucleus, QuarkEventBus } from '@alaq/nucleus'
export { nucleonExtensions } from '@alaq/nucleus'
export { Atom, savedAtom } from '@alaq/atom'
export { saved, stateless, tag, mixed } from '@alaq/atom'

export type { UnionNamespaces } from './namespaces'

export { UnionConstructor } from 'alak/UnionConstructor'
export { GetUnionCore } from 'alak/UnionCore'
export { UnionAtom, UnionAtomFactory } from 'alak/unionAtom'
// export { extendUnion, createExtendableStore } from 'alak/unionBuilder'

import { storage } from '@alaq/atom'

import { Nucleus, N, QuarkEventBus } from '@alaq/nucleus'

export { injectFacade } from 'alak/facadeInjector'

export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}

export type IUFacade<NS extends keyof ActiveUnions> = ActiveUnions[NS]['facade']

export abstract class UnionModel<NS extends keyof ActiveUnions> {
  $: Atomized<PureModel<this>>
  _: ActiveUnions[NS]['facade']
  _modelNamespace?: string
  _modelName?: string
}

export abstract class UnionMultiModel<NS extends keyof ActiveUnions> extends UnionModel<NS> {
  _modelId?: string | number
  _modelData?: any
}
