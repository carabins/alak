/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */

import { ref, Ref, watch, onMounted, onUnmounted } from 'vue'

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
