import { createState, isGhost } from '@alaq/deep-state'
import { createSyncNode } from './node'
import { SyncStoreOptions } from './types'

export class SyncStore {
  private _data: any
  private _proxy: any
  private _listeners = new Map<string, Set<Function>>()
  
  // Public for SyncNode access
  public _version = 0
  
  constructor(private options: SyncStoreOptions = {}) {
    this._data = {}
    
    const state = createState((_val, { path, target }) => {
      if (!path) return
      const key = path.split('.').pop()!
      const value = target[key]
      this._version++
      this._notifyPath(path, value)
    }, {
      ghosts: true,
      onGhost: (path) => {
        this.options.onFetch?.(path)
      }
    })
    
    this._proxy = state.deepWatch(this._data)
  }

  get(path: string): any {
    const val = this._resolvePath(path)
    return createSyncNode(this, path, val)
  }

  applyPatch(path: string, value: any) {
    this._setPath(path, value)
    this._version++
  }

  _subscribePath(path: string, fn: Function) {
    let set = this._listeners.get(path)
    if (!set) {
      set = new Set()
      this._listeners.set(path, set)
      this.options.onSubscribe?.(path)
    }
    set.add(fn)

    // Initial value push
    fn(this._resolvePath(path))

    return () => this._unsubscribePath(path, fn)
  }

  _unsubscribePath(path: string, fn: Function) {
    const set = this._listeners.get(path)
    if (set) {
      set.delete(fn)
      if (set.size === 0) {
        this._listeners.delete(path)
        this.options.onUnsubscribe?.(path)
      }
    }
  }

  _releaseNode(_node: any) {}

  public _resolvePath(path: string) {
    const parts = path.split('.')
    let curr = this._proxy
    for (const part of parts) {
      if (curr === undefined) return undefined
      curr = curr[part]
    }
    return curr
  }

  private _notifyPath(path: string, value: any) {
    this._listeners.get(path)?.forEach(fn => fn(value))
    
    for (const [lPath, handlers] of this._listeners.entries()) {
      if (lPath.startsWith(path + '.')) {
        const subValue = this._resolvePath(lPath)
        handlers.forEach(fn => fn(subValue))
      }
    }
  }

  private _setPath(path: string, value: any) {
    const parts = path.split('.')
    const last = parts.pop()!
    
    let curr = this._proxy
    let raw = this._data
    
    for (const part of parts) {
      if (raw[part] === undefined) {
        curr[part] = {}
      }
      curr = curr[part]
      raw = raw[part]
    }
    
    curr[last] = value
  }
}
