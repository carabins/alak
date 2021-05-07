// @ts-ignore
import { NS, ns } from 'lasens'
// @ts-ignore
// @ts-ignore
import { ref, reactive, watch } from 'vue'

// @ts-ignore
declare module 'vue' {
  interface Vue {
    $la: NS;
  }
}


function makeReactiveInProxy(thing) {
  const rx = reactive({})
  return new Proxy(rx, {
    set(target, p, value, receiver) {
      thing[p](value)
      return true
    },
    get(o, key) {
      const maybeAtom = thing[key]
      if (maybeAtom.isAtom) {
        if (!rx[key]) {
          maybeAtom.up(v => {
            rx[key] = v
          })
        }
        return rx[key]
      } else {
        return maybeAtom
      }
    },
  })
}

const n = {
  ns
}

export function SetupLaSensPlugin(namespace: any) {
  n.ns = namespace
}

export const la = new Proxy({}, {
  get(target, key) {
    let thing = n.ns[key]
    let rxCache = thing.__[key]
    if (rxCache)
      return rxCache
    else {
      return thing.__[key] = makeReactiveInProxy(thing)
    }
  },
}) as NS

export const LaSensPlugin = {
  install: (app) => {
    app.config.globalProperties.$la = la
  },
}
