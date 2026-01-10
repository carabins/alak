/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */


const Vue = require('vue')
const { ref, reactive, watch } = Vue
import {UnwrapNestedRefs} from '@vue/reactivity'

export {vueController} from "./vueController";

const vueKey = 'vueKey'

export function vueNucleon<T = any>(n: INucleus<T>): any {
  if (n.hasMeta(vueKey)) {
    return n.getMeta(vueKey)
  } else {
    const l = ref()
    if (n.value) {
      l.value = n.value
    }
    n.up((v) => (l.value = v))
    return l
  }
}

export function watchVueNucleon<T = any>(n: INucleus<T>) {
  const l = vueNucleon(n)
  watch(l, (v) => {
    n(v)
  })
  return l
}

const vueAtomKey = '__vue_reactive'
export default function vueAtom<M>(
  atom: IAtom<M> | IUnionAtom<M, any>,
): UnwrapNestedRefs<ClassToKV<M>> {
  if (!atom.known.meta) {
    atom.known.meta = {}
  }
  let r = atom.known.meta[vueAtomKey]
  const values = atom.known.values()

  if (!r) {
    r = atom[vueAtomKey] = reactive(
      Object.assign({}, values, atom.known.actions),
    ) as UnwrapNestedRefs<ClassToKV<M>>
  }
  const listeners = {}
  Object.keys(values).forEach((k) => {
    listeners[k] = (v) => {
      r[k] = v
    }
  })
  Object.keys(values).forEach((k) => {
    atom.core[k].up(listeners[k])
  })
  return r
}

export function watchVueAtom<M>(atom: IAtom<M> | IUnionAtom<M, any>) {
  const vueReactive = vueAtom(atom)
  return proxyReactiveSyncedWithAtom(vueReactive, atom.core) as UnwrapNestedRefs<ClassToKV<M>>
}

const skip = {
  __v_raw: true
}
function proxyReactiveSyncedWithAtom(vueReactive, atomCore) {

  return new Proxy(vueReactive, {
    get(vueReactive, k) {
      if (!skip[k] && typeof k === 'string') {
        atomCore[k]
      }
      return vueReactive[k]
    },
    set(target: any, k: string | symbol, newValue: any, receiver: any): boolean {
      target[k] = newValue
      if (typeof k === 'string' && atomCore[k]) {
        atomCore[k](newValue)
      }
      return true
    }
  })
}
