export const TrackTypes = {
  GET: "get",
  HAS: "has",
  ITERATE: "iterate"
}
export const TriggerOpTypes = {
  SET: "set",
  ADD: "add",
  DELETE: "delete",
  CLEAR: "clear"
}

export declare enum ReactiveFlags {
  SKIP = "__v_skip",
  IS_REACTIVE = "__v_isReactive",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow",
  RAW = "__v_raw",
  IS_REF = "__v_isRef"
}


export interface IDeepStateChange  {
  path: string,
  type: string,
  target: any,
  oldValue?: any
  value?: any
}

export type NotifyFn = (value, from: IDeepStateChange) => any

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

export interface IDeepState {
  isRoot?: boolean
  key?: string | symbol
  // subProxies?: WeakMap<object, any>
  subProxies?: Record<string | symbol, any>
  parent?: IDeepState
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
  __parent__: IDeepState
  __isProxy__: boolean
  __raw__: T
}
