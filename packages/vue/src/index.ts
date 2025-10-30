/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */


import { ref, reactive, watch } from 'vue'
import {UnwrapNestedRefs} from '@vue/reactivity'

export {vueController} from "./vueController";
export { VueNucleusPlugin } from './nucleusPlugin';
export { VueRefPlugin } from './vueRefPlugin';

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

export function watchVueAtom<M>(atom: IAtom<M> | IUnionAtom<M, any>, dedup= true) {
  const vueReactive = vueAtom(atom)
  return proxyReactiveSyncedWithAtom(vueReactive, atom, dedup) as UnwrapNestedRefs<ClassToKV<M>>
}

const skip = {
  __v_raw: true,
  __v_isRef: true,
  __v_isReactive: true,
  __v_skip: true,
}

function isComplexValue(value: any): boolean {
  return value !== null && (typeof value === 'object' || Array.isArray(value))
}

function proxyReactiveSyncedWithAtom(vueReactive, atom, dedup) {
  const atomCore = atom.core
  const watchers = new Map()

  // Setup deep watchers for complex values (objects and arrays)
  const values = atom.known.values()
  Object.keys(values).forEach((k) => {
    const currentValue = values[k]
    if (isComplexValue(currentValue)) {
      setupDeepWatcher(k, vueReactive, atomCore)
    }
  })

  function setupDeepWatcher(key: string, reactive: any, core: any) {
    // Remove old watcher if exists
    if (watchers.has(key)) {
      watchers.get(key)()
      watchers.delete(key)
    }

    // Setup new deep watcher
    const stopWatch = watch(
      () => reactive[key],
      (newValue) => {
        const nucleus = core[key]
        if (!nucleus) return

        // For complex values, always sync (deep changes won't be caught by simple equality)
        // For simple values, check dedup
        if (!dedup || !isComplexValue(newValue) || nucleus.value !== newValue) {
          nucleus(newValue)
        }
      },
      { deep: true }
    )
    watchers.set(key, stopWatch)
  }

  return new Proxy(vueReactive, {
    get(vueReactive, k) {
      if (!skip[k] && typeof k === 'string') {
        atomCore[k]
      }
      return vueReactive[k]
    },
    set(target: any, k: string | symbol, newValue: any, receiver: any): boolean {
      const oldValue = target[k]
      target[k] = newValue

      if (typeof k === 'string') {
        const nucleus = atomCore[k]
        if (!nucleus) return true

        // Setup deep watcher for new complex values
        if (isComplexValue(newValue) && (!isComplexValue(oldValue) || oldValue !== newValue)) {
          setupDeepWatcher(k, target, atomCore)
        }

        // Sync with atom using strict equality for dedup
        if (dedup && nucleus.value === newValue) {
          return true
        }
        nucleus(newValue)
      }
      return true
    }
  })
}
