// @ts-ignore
import { NS, ns } from 'lasens'
// @ts-ignore
// @ts-ignore
import { ref, reactive, watch } from 'vue'


type PickAtoms<T> = { [K in keyof T]: PickType<LosClarify<T[K]>, IAtom<any>> }
type GlobalValues<T> = { [K in keyof T]: ModuleValues<T[K]> }
type ModuleValues<T> = { [K in keyof T]: ExtractValue<T[K]> }

type ExtractValue<T> = T extends IAtom<any> ? T["value"] : Promise<T>


declare module 'vue' {
  interface Vue {
    $la: NS;
    $v: GlobalValues<PickAtoms<NS>>
    V: GlobalValues<PickAtoms<NS>>
    $a: NS
    A: NS
  }
}



type LosFilterFlags<T, Condition> = {
  [Key in keyof T]: T[Key] extends Condition ? Key : never
}

type LosAllowedNames<T, Condition> = LosFilterFlags<T, Condition>[keyof T]
type LosHiddenSens = {
  $?: any
  _?: any
  $ns: any
  // __?: any
  $target: any
  $uid?: any
  $id?: any
  $link?: any
  _start?: AnyFunction
  _decay?: AnyFunction
  _private?: any
}

type LosClarify<T> = Omit<T, keyof LosHiddenSens>
type PickType<T, Condition> = Pick<T, LosAllowedNames<T, Condition>>

///







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
  ns,
}

export function SetupLaSensPlugin(namespace: any) {
  n.ns = namespace
}

export const vi = new Proxy({}, {
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
    app.config.globalProperties.$la = vi
    app.config.globalProperties.$v = vi
    app.config.globalProperties.V = vi
    app.config.globalProperties.A = NS
    app.config.globalProperties.$a = NS
  },
}
