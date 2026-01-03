// Константы, используемые в системе глубокого отслеживания

// Внутренние свойства прокси
import {IDeepState} from "./types";

export const INTERNAL_PROPERTIES = {
  PARENT: '__parent__',
  IS_PROXY: '__isProxy__',
  RAW: '__raw__',
}

// Методы массива, изменяющие его состояние
export const MUTATING_ARRAY_METHODS:  string[] = [
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'
]

// Неизменяющие методы массива, требующие отслеживания
export const ITERATION_ARRAY_METHODS: string[] = [
  'includes', 'indexOf', 'lastIndexOf', 'join', 'concat', 'slice'
]

export const arrayMethods: Record<string | symbol, Function> = {}
MUTATING_ARRAY_METHODS.forEach(method => {
  const original = Array.prototype[method as keyof Array<any>]
  arrayMethods[method] = function (this: any, ...args: any[]) {
    // isArrayMethod[method] = true
    const parent = this.__parent__ as IDeepState
    const target = parent.value
    const result = original.apply(target, args)
    
    // Очищаем кэш прокси, так как индексы могли сдвинуться
    parent.subProxies = {}
    
    parent.root.notify(parent.parentPath, method, target)
    return result
  }
})


ITERATION_ARRAY_METHODS.forEach(method => {
  const original = Array.prototype[method as keyof Array<any>]
  arrayMethods[method] = function (this: any, ...args: any[]) {
    const parent = this.__parent__ as IDeepState
    const result = original.apply(parent.value, args)
    parent.root.notify(parent.parentPath, method, parent.value)
    return result
  }
})


// // Методы Map, изменяющие состояние коллекции
// export const MUTATING_MAP_METHODS: string[] = [
//   'set', 'delete', 'clear'
// ]
//
// // Методы Map, не изменяющие состояние, но требующие отслеживания
// export const ITERATION_MAP_METHODS: string[] = [
//   'get', 'has', 'forEach', 'keys', 'values', 'entries'
// ]
//
// // Методы Set, изменяющие состояние коллекции
// export const MUTATING_SET_METHODS: string[] = [
//   'add', 'delete', 'clear'
// ]
//
// // Методы Set, не изменяющие состояние, но требующие отслеживания
// export const ITERATION_SET_METHODS: string[] = [
//   'has', 'forEach', 'keys', 'values', 'entries'
// ]

// export const mapMethods: Record<string | symbol, Function> = {}
// MUTATING_MAP_METHODS.forEach(method => {
//   const original = Map.prototype[method]
//   mapMethods[method] = function (this: any, ...args: any[]) {
//     const parent = this.__parent__ as IParent
//     const target = parent.value
//     const result = original.apply(target, args)
//     parent.root.notify(parent.parentPath, method, target)
//     return result
//   }
// })
//
//
// ITERATION_MAP_METHODS.forEach(method => {
//   const original = Map.prototype[method]
//   mapMethods[method] = function (this: any, ...args: any[]) {
//     const parent = this.__parent__ as IParent
//     const result = original.apply(parent.value, args)
//     parent.root.notify(parent.parentPath, method, parent.value)
//     return result
//   }
// })
//
//
// export const setMethods: Record<string | symbol, Function> = {}
// MUTATING_SET_METHODS.forEach(method => {
//   const original = Set.prototype[method]
//   setMethods[method] = function (this: any, ...args: any[]) {
//     const parent = this.__parent__ as IParent
//     const target = parent.value
//     const result = original.apply(target, args)
//     parent.root.notify(parent.parentPath, method, target)
//     return result
//   }
// })
//
//
// ITERATION_SET_METHODS.forEach(method => {
//   const original = Set.prototype[method]
//   setMethods[method] = function (this: any, ...args: any[]) {
//     const parent = this.__parent__ as IParent
//     const result = original.apply(parent.value, args)
//     parent.root.notify(parent.parentPath, method, parent.value)
//     return result
//   }
// })


function arrayToTrueMap<T extends readonly string[]>(
  arr: T
): Record<T[number], true> {
  const result = {} as Record<T[number], true>
  for (const key of arr) {
    result[key] = true
  }
  return result
}

const RETURN_TRUE_PROPS = ['__v_isReactive', '__isProxy__']
const RETURN_FALSE_PROPS = ['__v_isReadonly', '__v_isShallow']
const RETURN_RAW_PROPS = ['__raw__', '__v_raw']

export const RETURN_TRUE_MAP = arrayToTrueMap(RETURN_TRUE_PROPS)
export const RETURN_FALSE_MAP = arrayToTrueMap(RETURN_FALSE_PROPS)
export const RETURN_RAW_MAP = arrayToTrueMap(RETURN_RAW_PROPS)

