/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { ref, Ref, watch, onMounted, onUnmounted, reactive } from 'vue'

export function createReactiveVueAtomListener<T>(inital = {}) {
  const r = reactive(inital)
  const watched = {}
  function atomListener(key, value) {
    r[key] = value
  }
  const proxy = new Proxy(r, {
    get(o, k) {
      if (!watched[k]) {
        watch(
          () => r[k],
          (v) => {
            if (r[k] !== r[k].value) {
              r[k](v)
            }
          },
        )
        r[k]
        watched[k] = true
      }
      return o[k]
    },
  })
  return [r, atomListener]
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
