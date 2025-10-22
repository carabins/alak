

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
  }
}


