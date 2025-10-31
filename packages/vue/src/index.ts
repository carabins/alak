/**
 * @alaq/vue - Vue 3 reactivity integration
 *
 * New Architecture (Atom v6):
 * - VueQuarkRefPlugin - Quark as Vue Ref
 * - StateReactivePlugin - atom.state as Vue reactive
 * - ViewMarkerPlugin - Selective reactivity with view() marker
 *
 * Legacy Architecture (Atom v5):
 * - vueAtom() - One-way atom -> Vue reactive
 * - watchVueAtom() - Two-way atom <-> Vue reactive sync
 *
 * @packageDocumentation
 */

// ============================================================================
// NEW ARCHITECTURE - Atom v6 Plugins
// ============================================================================

export { VueQuarkRefPlugin } from './plugins/quarkRefPlugin'
export { StateReactivePlugin } from './plugins/stateReactivePlugin'
export { ViewMarkerPlugin, view, isView } from './plugins/viewMarkerPlugin'

export type {
  VueQuarkRefAtom,
  StateReactiveAtom,
  ViewMarkerAtom,
  ViewMarker
} from './types'

// ============================================================================
// LEGACY ARCHITECTURE - Atom v5 Functions
// ============================================================================

import { ref, reactive, watch } from 'vue'
import {UnwrapNestedRefs} from '@vue/reactivity'

/**
 * Convert nucleus to Vue ref (legacy, one-way sync)
 *
 * @deprecated For old nucleus architecture. Use new plugins for Atom v6.
 */
export function vueNucleon<T = any>(n: INucleus<T>): any {
  const vueKey = 'vueKey'

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

/**
 * Convert nucleus to Vue ref with two-way sync (legacy)
 *
 * @deprecated For old nucleus architecture. Use new plugins for Atom v6.
 */
export function watchVueNucleon<T = any>(n: INucleus<T>) {
  const l = vueNucleon(n)
  watch(l, (v) => {
    n(v)
  })
  return l
}

/**
 * Create Vue reactive from atom (one-way: atom -> Vue)
 *
 * @deprecated For Atom v5. Use StateReactivePlugin for Atom v6.
 * @example
 * ```ts
 * const atom = Atom({ model: Counter })
 * const state = vueAtom(atom)
 * // state updates when atom.core changes
 * ```
 */
export default function vueAtom<M>(
  atom: IAtom<M> | IUnionAtom<M, any>,
): UnwrapNestedRefs<ClassToKV<M>> {
  const vueAtomKey = '__vue_reactive'
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
