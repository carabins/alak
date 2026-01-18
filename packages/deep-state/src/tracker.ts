import {IDeepState, NotifyFn, RootNotify, DeepOptions} from './types'
import {baseHandler} from "./handler";


/**
 * Создает deep state instance для отслеживания изменений в объектах
 */
export function createState(notify: NotifyFn, options: DeepOptions = {}) {
  const finalOptions: DeepOptions = {
    deepArrays: options.deepArrays ?? true,
    deepObjects: options.deepObjects ?? true,
    ghosts: options.ghosts ?? false,
    onGhost: options.onGhost
  }


  const root: IDeepState = {
    isRoot: true,
    root: {
      ...finalOptions,
      notify(path, type, target, oldValue) {
        notify(root.value, {path, type, target, oldValue})
      }
    },
  }

  return {
    root,
    deepWatch(value?) {
      root.value = value
      return new Proxy(root, baseHandler)
    },
  }
}

export type IDeepWatcher = ReturnType<typeof createState>
