import { Qv } from '@alaq/quark'
import { ISyncNode, SyncStatus } from './types'
import { isGhost } from '@alaq/deep-state'
import quarkProto from '@alaq/quark/prototype'

export function createSyncNode<T = any>(store: any, path: string, initialProxy: any): ISyncNode<T> {
  if (!store) throw new Error("SyncNode created without store")

  let _lastVersion = store._version
  let _cachedValue = initialProxy
  
  const $status = Qv<SyncStatus>(isGhost(initialProxy) ? 'pending' : 'ready')
  const $error = Qv<any>(null)

  // Fast value access with version check
  function getLatestValue() {
    if (_lastVersion === store._version) {
      return _cachedValue
    }
    const val = store._resolvePath(path)
    _cachedValue = val
    _lastVersion = store._version
    $status(isGhost(val) ? 'pending' : 'ready')
    return val
  }

  const node = function(value?: T) {
    if (arguments.length === 0) return getLatestValue()
    store.applyPatch(path, value)
    return value
  }

  Object.setPrototypeOf(node, quarkProto)

  const properties = {
    __q: { value: true, enumerable: true },
    
    $status: { value: $status },
    $error: { value: $error },
    
    value: {
      get() { return getLatestValue() },
      enumerable: true
    },

    $meta: {
      get() {
        const val = getLatestValue()
        return {
          isGhost: isGhost(val),
          path: path
        }
      }
    },

    // --- Internal API ---

    _get: {
      value: function(key: string) {
        const val = getLatestValue()
        return val ? val[key] : undefined
      }
    },

    _node: {
      value: function(key: string) {
        return store.get(path + '.' + key)
      }
    },

    _act: {
      value: function(name: string, args?: any) {
        if (!store.options.onAction) {
          console.warn(`No onAction handler in SyncStore for ${name}`)
          return Promise.resolve()
        }
        return store.options.onAction(name, path, args)
      }
    },

    // --- Lifecycle ---

    $release: {
      value: function() { store._releaseNode(node) }
    },

    up: {
      value: function(listener: (val: T) => void) {
        return store._subscribePath(path, (newVal: any) => {
          _cachedValue = newVal
          _lastVersion = store._version
          $status(isGhost(newVal) ? 'pending' : 'ready')
          listener(newVal)
        })
      }
    },

    down: {
      value: function(listener: (val: T) => void) {
        store._unsubscribePath(path, listener)
      }
    },
    
    _path: { value: path },
    _store: { value: store }
  }

  Object.defineProperties(node, properties)

  return node as unknown as ISyncNode<T>
}
