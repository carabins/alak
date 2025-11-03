import {IParent, NotifyFn, RootNotify, DeepOptions} from './types'
import {baseHandler} from "./handler";


// Для отслеживания уже обернутых объектов (как во Vue)
//const reactiveMap = new WeakMap<object, any>()


/**
 * Создает deep state instance для отслеживания изменений в объектах
 */
export function createState(notify: NotifyFn, options: DeepOptions = {}) {
  const finalOptions: DeepOptions = {
    deepArrays: options.deepArrays ?? true,    // ✅ По умолчанию выключено
    deepObjects: options.deepObjects ?? true,   // ✅ По умолчанию включено
  }


  const root: IParent = {
    isRoot: true,
    root: {
      ...finalOptions,
      notify(path, type, target, oldValue) {
        notify(root.value, {path, type, target, oldValue})
      }
    },
    parentPath: ""
  }

  return {
    root,
    deepWatch(value) {
      root.value = value
      return new Proxy(root, baseHandler)
    },
  }
}


export default createState
