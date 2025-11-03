export type NotifyFn = (value, from: {
  path: string,
  type: string,
  target: any,
  oldValue?: any
}) => any

export type RootNotify = (
  path: string,
  type: string,
  target: any,
  oldValue?: any,
) => void

export interface DeepOptions {
  deepArrays?: boolean      // Глубокая реактивность для элементов массивов (по умолчанию false)
  deepObjects?: boolean     // Глубокая реактивность для объектов (по умолчанию true)
}

export interface IParent {
  isRoot?: boolean
  key?: string | symbol
  // subProxies?: WeakMap<object, any>
  subProxies?: Record<string | symbol, any>
  parent?: IParent
  isShallow?: boolean
  value?: any
  root: {
    notify: RootNotify
  } & DeepOptions
  parentPath?: string
  type?: string
}

// Тип для реактивных оберток (прокси)
export type ReactiveProxy<T> = T & {
  __parent__: IParent
  __isProxy__: boolean
  __raw__: T
}
