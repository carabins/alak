

declare interface ARef<T = any> {
  value: T
}

declare interface INucleus<T> {
  vv: T
  rv: T
  ref: ARef<T>
  refWatch: ARef<T>
}

declare interface Quark {
  vueRef: ARef
  vueWatch: Boolean
  __v_isRef?: boolean
  __v_isShallow?: boolean
  __v_isReadonly?: boolean
}

declare module '@alaq/nucleus/' {
  interface INucleon<T> {
    vv: T
    rv: T
    ref: ARef<T>
    refWatch: ARef<T>
  }

  interface Quark {
    vueRef: ARef
    vueWatch: Boolean
    __v_isRef?: boolean
    __v_isShallow?: boolean
    __v_isReadonly?: boolean
  }
}


