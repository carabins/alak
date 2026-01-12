import {GetUnionCore} from 'alak/UnionCore'

const Vue = require('vue')
import vueAtom, {watchVueAtom} from './vueAdapter'

type Reactive<T> = typeof Vue.Reactive

export function vueController<T>(c: {
  namespace?: string
  name: string
  model: T
  sync?: boolean
}): () => {
  state: Reactive<PureState<Instance<T>>>
  core: IAtomCore<Instance<T>>
} {

  function ctr() {
    const uc = GetUnionCore(c.namespace)
    let a = uc.services.atoms[c.name]
    if (!a) {
      uc.addAtom(Object.assign({}, c))
      a = uc.services.atoms[c.name]
    }
    return {
      state: c.sync ? watchVueAtom(a) : vueAtom(a) as Reactive<PureState<Instance<T>>>,
      core: a.core as IAtomCore<Instance<T>>,
    }
  }

  return ctr
}

