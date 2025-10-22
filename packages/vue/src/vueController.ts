import {GetUnionCore} from 'alak/UnionCore'

const Vue = require('vue')
import vueAtom, {watchVueAtom} from '.'

type Reactive<T> = typeof Vue.Reactive


interface AlakVueControllerConstructor<T> {
  namespace?: string;
  name: string;
  model: T;
  sync?: boolean;
}
interface AlakVueStateOption<T> {
  namespace?: string;
  name: string;
  model: T;
  sync?: boolean;
}
export interface AlakVueControl<T> {
  (): {
    state: PureState<Instance<T>>
    core: IAtomCore<Instance<T>>
  }
}


export function vueController<T>(c: AlakVueStateOption<T>): AlakVueControl<T>{

  function ctr() {
    const uc = GetUnionCore(c.namespace)
    let a = uc.services.atoms[c.name]
    if (!a) {
      uc.addAtom(Object.assign({}, c))
      a = uc.services.atoms[c.name]
    }
    return {
      state: c.sync ? watchVueAtom(a) : vueAtom(a) as PureState<Instance<T>>,
      core: a.core as IAtomCore<Instance<T>>,
    }
  }
  return ctr
}

