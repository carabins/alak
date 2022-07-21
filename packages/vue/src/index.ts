/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { ref, Ref, watch, onMounted, onUnmounted, reactive } from 'vue'
import { Atom, createAtom } from '@alaq/atom/index'
import { UnwrapNestedRefs } from '@vue/reactivity'

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
  const watched = {}

  const proxy = new Proxy(r, {
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
