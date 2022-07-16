declare interface Ref<T = any> {
  value: T
}

declare interface INucleon<T> {
  vv: T
  rv: T
  ref: Ref<T>
  refWatch: Ref<T>
}

declare interface Quark {
  vueRef: Ref
  vueWatch: Boolean
}

declare module '@alaq/nucleus/' {
  interface INucleon<T> {
    vv: T
    rv: T
    ref: Ref<T>
    refWatch: Ref<T>
  }

  interface Quark {
    vueRef: Ref
    vueWatch: Boolean
  }
}
