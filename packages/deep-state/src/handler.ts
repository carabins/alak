import {IDeepState} from './types'
import {arrayMethods, RETURN_FALSE_MAP, RETURN_RAW_MAP, RETURN_TRUE_MAP} from './constants'


export const baseHandler = {
  set(parent: IDeepState, key: string | symbol, newValue: any, receiver: any) {
    const target = parent.value
    // target[key] = newValue


    if (typeof key === 'symbol') {
      return Reflect.set(target, key, newValue, receiver)
    }

    const oldValue = target[key]
    target[key] = newValue

    // Переиспользуем существующий прокси если он есть
    if (parent.subProxies && parent.subProxies[key]) {
      const existingProxy = parent.subProxies[key]
      const childParent = existingProxy.__parent__ as IDeepState

      // Если новое значение - объект, обновляем прокси
      if (typeof newValue === 'object' && newValue !== null) {
        childParent.value = newValue
        // Очищаем дочерние прокси (они пересоздадутся для нового объекта)
        childParent.subProxies = {}
      } else {
        // Новое значение - примитив, удаляем прокси
        delete parent.subProxies[key]
      }
    }

    const path = parent.parentPath ? parent.parentPath + "." + String(key) : String(key)
    parent.root.notify(path, "set", target, oldValue)
    return true
  },
  get(parent: IDeepState, key: string, receiver: any) {

    if (key === '__parent__') return parent
    if (RETURN_TRUE_MAP[key]) return true
    if (RETURN_FALSE_MAP[key]) return false
    if (RETURN_RAW_MAP[key]) return parent.value

    const target = parent.value
    const value = target[key]
    if (value == null) return value

    const type = typeof value
    if (type === 'symbol') {
      return Reflect.get(target, key, receiver)
    }


    const isArray = Array.isArray(target)
    const root = parent.root
    if (isArray) {
      if (arrayMethods[key]) {
        return arrayMethods[key]
      }

      if (key === 'length') {
        return value
      }
      if (!isNaN(Number(key)) && !root.deepArrays) {
        return value
      }
    }
    if (type !== 'object') return value

    // Создаем вложенный прокси
    if (!parent.subProxies) {
      parent.subProxies = {}
    }


    let proxy = parent.subProxies[key]
    if (!proxy) {
      const childParent: IDeepState = {
        parent,
        root,
        value,
        key,
        parentPath: parent.parentPath ? parent.parentPath + "." + key : key
      }

      proxy = new Proxy(childParent, this)
      parent.subProxies[key] = proxy
    }
    return proxy
  },


  deleteProperty(parent: IDeepState, key: string | symbol) {
    const target = parent.value

    if (typeof key === 'symbol') {
      return Reflect.deleteProperty(target, key)
    }

    // const hadKey = Object.prototype.hasOwnProperty.call(target, key)
    // const oldValue = target[key]

    const result = Reflect.deleteProperty(target, key)

    if (parent.subProxies && parent.subProxies[key])
      delete parent.subProxies[key]

    const path = parent.parentPath ? parent.parentPath + "." + key : key
    parent.root.notify(path, "delete", target)

    return result
  },

  has(parent: IDeepState, key: string) {
    const target = parent.value
    const result = Reflect.has(target, key)

    const path = parent.parentPath ? parent.parentPath + "." + key : key
    parent.root.notify(path, "has", target)
    return result
  },

  ownKeys(parent: IDeepState) {
    const target = parent.value
    // track(target, TrackOpTypes.ITERATE, Array.isArray(target) ? 'length' : Symbol.iterator)
    parent.root.notify(parent.parentPath, "ownKeys", target)
    return Reflect.ownKeys(target)
  }
}


