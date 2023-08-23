/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { reactive, Ref, ref, watch } from 'vue'
import { UnwrapNestedRefs } from '@vue/reactivity'

const vueKey = 'vueKey'

export function vueNucleon<T = any>(n: INucleus<T>): Ref<T> {
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
export default function vueAtom<M>(atom: IAtom<M>): UnwrapNestedRefs<ClassToKV<M>> {
  let r = atom['kv'][vueAtomKey]
  const values = atom.getValues()
  const actions = atom['getActions']()
  if (!r) {
    r = atom['kv'] = reactive(Object.assign({}, values, actions)) as UnwrapNestedRefs<ClassToKV<M>>
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

export function watchVueAtom<M>(atom: IAtom<M>) {
  const vueReactive = vueAtom(atom)
  return proxyReactiveSyncedWithAtom(vueReactive, atom.core) as UnwrapNestedRefs<ClassToKV<M>>
}

function proxyReactiveSyncedWithAtom(vueReactive, atomCore) {
  const watched = {}
  return new Proxy(vueReactive, {
    get(vueReactive, k) {
      if (!watched[k]) {
        watch(
          () => vueReactive[k],
          (v) => {
            if (vueReactive[k] !== atomCore[k].value) {
              atomCore[k](v)
            }
          },
        )
        atomCore[k]
        watched[k] = true
      }
      return vueReactive[k]
    },
  })
}
