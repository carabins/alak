import {ActiveUnions} from "alak/namespaces";


export {N, Nucleus, QuarkEventBus} from '@alaq/nucleus/index'
export {nucleonExtensions} from '@alaq/nucleus/create'
export {Atom, savedAtom} from '@alaq/atom/index'
export {saved, stateless, rune} from '@alaq/atom/property'

export {UnionNamespaces} from 'alak/namespaces'

export {UnionFactory} from "alak/UnionFactory"
export {UnionCoreFactory} from "alak/UnionCoreFactory"
export {UnionFacade} from "alak/UnionFacade"
export {UnionAtom, UnionAtomFactory} from "alak/unionAtom"


import {storage} from '@alaq/atom/storage'

import {Nucleus, N, QuarkEventBus} from '@alaq/nucleus/index'
import {unionAtom} from "alak/unionAtom";

export const NucleusStorage = storage
export const NStored = (name, value) => {
  const n = N(value)
  n.setId(name)
  storage.init(n)
  return n
}


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
