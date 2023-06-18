import { UnwrapNestedRefs } from '@vue/reactivity'
import { onMounted, onUnmounted, reactive } from 'vue'

const vueAtomKey = '__vue_reactive'
export default function ReactiveAtom<M>(atom: IAtom<M>): UnwrapNestedRefs<ClassToKV<M>> {
  let r = atom[vueAtomKey]
  const values = atom.getValues()
  if (!r) {
    r = reactive(values) as UnwrapNestedRefs<ClassToKV<M>>
  }
  const listeners = {}
  Object.keys(values).forEach((k) => {
    listeners[k] = (v) => {
      r[k] = v
    }
  })
  onMounted(() => {
    Object.keys(values).forEach((k) => {
      atom.core[k].up(listeners[k])
    })
  })
  onUnmounted(() => {
    Object.keys(values).forEach((k) => {
      atom.core[k].down(listeners[k])
    })
  })
  // atom.bus.addEverythingListener((event, data) => {
  //   console.log('::', event, data)
  // })

  return r
}
