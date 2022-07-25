/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { onMounted, onUnmounted, reactive, Ref, ref, watch } from 'vue'
import { createAtom } from '@alaq/atom/index'
import { UnwrapNestedRefs } from '@vue/reactivity'
import { getMolecule } from '@alaq/molecule/index'

function warpVRtoA(r, a) {
  const watched = {}
  return new Proxy(r, {
    get(o, k) {
      if (!watched[k]) {
        watch(
          () => o[k],
          (v) => {
            if (o[k] !== a[k].value) {
              a[k](v)
            }
          },
        )
        a[k]
        watched[k] = true
      }
      return o[k]
    },
  })
}

export function useAtomFactory(options: {
  props: any
  watch: string
  keys?: string[]
  startValues?: Record<string, any>
}) {
  const m = getMolecule()
  const state = {
    atom: m.atoms[options.props[options.watch]],
  }

  const keys = options.keys || Object.keys(options.startValues)

  const react = reactive(options.startValues ? Object.assign({}, options.startValues) : {})

  onMounted(() => {
    keys.forEach((rk) => {
      watch(
        () => react[rk],
        (v) => {
          state.atom.core[rk](v)
        },
      )
    })
  })
  const listeners = []
  const free = () => {
    while (listeners.length) {
      listeners.pop()()
    }
  }
  onUnmounted(() => {
    free()
  })

  watch(
    () => options.props[options.watch],
    (v) => {
      free()
      if (!m.atoms[v]) {
        return
      }
      state.atom = m.atoms[v]
      keys.forEach((rk) => {
        const l = (rv) => {
          react[rk] = rv
        }
        const n = state.atom.core[rk]
        if (n.isEmpty) {
          react[rk] = options.startValues[rk]
        }
        n.up(l)
        listeners.push(() => n.down(l))
      })
    },
  )

  return react
}

export function vueAtom<Model extends object>(atomConfig: {
  name?: string
  model?: Model
  nucleusStrategy?: NucleusStrategy
}) {
  const r = reactive(atomConfig.model)

  function listener(key, value) {
    r[key] = value
  }

  const a = createAtom(atomConfig.model, {
    name: atomConfig.name,
    nucleusStrategy: atomConfig.nucleusStrategy,
    listener,
  }).one()
  const proxy = warpVRtoA(r, a)
  return [proxy, a] as [UnwrapNestedRefs<Model>, Atomized<Model>]
}

export function useNucleon<T = any>(n: INucleon<T>) {
  const l = ref()
  if (n.value) {
    l.value = n.value
  }
  const listener = (v) => {
    l.value = v
  }
  onMounted(() => {
    n.up(listener)
  })
  onUnmounted(() => {
    n.down(listener)
  })
  return l as Ref<T>
}

export function useWatchNucleon<T = any>(n: INucleon<T>) {
  const l = useNucleon(n)
  watch(l, (v) => {
    n(v)
  })
  return l
}

export const vueNucleonExtension: NucleonExtension = {
  ref() {
    if (!this.vueRef) {
      this.vueRef = ref()
      this._.up((v) => (this.vueRef.value = v))
    }
    return this.vueRef
  },
  refWatch() {
    watch(this.vueRef, (v) => {
      this(v)
    })
    return this.vueRef
  },
  vv() {
    return this._.ref.value
  },
  vw() {
    return this._.refWatch.value
  },
}

export default vueNucleonExtension
