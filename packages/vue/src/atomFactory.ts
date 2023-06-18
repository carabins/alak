import { activeCluster } from 'alak/index'
import { onMounted, onUnmounted, reactive, watch } from 'vue'

export default function useAtomFactory(options: {
  props: any
  watch: string
  keys?: string[]
  startValues?: Record<string, any>
}) {
  const m = activeCluster()
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
