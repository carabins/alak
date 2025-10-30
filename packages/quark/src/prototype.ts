/**
 * Quark Prototype - методы кварка
 */

import { HAS_LISTENERS, HAS_EVENTS, HAS_REALM, DEDUP, STATELESS, WAS_SET, SILENT } from './flags'
import { quantumBus } from './quantum-bus'

type AnyFunction = (...args: any[]) => any
type Listener<T> = (value: T, quark: any) => void

/** Базовый прототип кварка */
export const quarkProto = {
  up(this: any, listener: Listener<any>) {
    // Lazy init listeners - используем массив вместо Set (быстрее для <10 listeners)
    if (!this.listeners) {
      this.listeners = []
      this._flags |= HAS_LISTENERS
    }

    this.listeners.push(listener)

    // Немедленно вызываем если значение существует (не undefined)
    // Проверяем значение, а не WAS_SET флаг, потому что значение может быть установлено в конструкторе
    if (this.value !== undefined) {
      listener(this.value, this)
    }
    return this
  },

  down(this: any, listener: Listener<any>) {
    if (this.listeners) {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
        if (this.listeners.length === 0) {
          this._flags &= ~HAS_LISTENERS
        }
      }
    }
    return this
  },

  silent(this: any, fn: () => void) {
    this._flags |= SILENT
    try {
      fn()
    } finally {
      this._flags &= ~SILENT
    }
    return this
  },

  on(this: any, event: string, listener: AnyFunction) {
    // Wildcard: '*:*' - все события всех realms
    if (event === '*:*') {
      quantumBus.onWildcard(listener)
      return this
    }

    // Wildcard: '*' - все события текущего realm
    if (event === '*') {
      if (this._flags & HAS_REALM) {
        // Подписываемся на специальное событие _wildcard в своём realm
        const realmBus = quantumBus.getRealm(this._realm)
        if (!this._wildcardListeners) {
          this._wildcardListeners = new Set()
        }
        this._wildcardListeners.add(listener)
      }
      return this
    }

    // Парсим realm:event
    const colonIdx = event.indexOf(':')
    if (colonIdx > 0) {
      // Подписка на событие из другого realm
      const realm = event.slice(0, colonIdx)
      const evt = event.slice(colonIdx + 1)
      const realmBus = quantumBus.getRealm(realm)
      realmBus.on(evt, listener)
      return this
    }

    // Локальная подписка - lazy init
    if (!(this._flags & HAS_EVENTS)) {
      this._events = new Map()
      this._eventCounts = {}
      this._flags |= HAS_EVENTS
    }

    let set = this._events.get(event)
    if (!set) {
      set = new Set()
      this._events.set(event, set)
      this._eventCounts[event] = 0
    }

    set.add(listener)
    this._eventCounts[event]++

    return this
  },

  off(this: any, event: string, listener: AnyFunction) {
    // Wildcard
    if (event === '*:*') {
      quantumBus.offWildcard(listener)
      return this
    }

    if (event === '*') {
      this._wildcardListeners?.delete(listener)
      return this
    }

    // Realm event
    const colonIdx = event.indexOf(':')
    if (colonIdx > 0) {
      const realm = event.slice(0, colonIdx)
      const evt = event.slice(colonIdx + 1)
      const realmBus = quantumBus.getRealm(realm)
      realmBus.off(evt, listener)
      return this
    }

    // Локальный event
    const set = this._events?.get(event)
    if (set?.delete(listener)) {
      this._eventCounts[event]--

      if (set.size === 0) {
        this._events.delete(event)
        delete this._eventCounts[event]

        if (this._events.size === 0) {
          this._flags &= ~HAS_EVENTS
        }
      }
    }
    return this
  },

  once(this: any, event: string, listener: AnyFunction) {
    const onceListener = (data: any) => {
      this.off(event, onceListener)
      listener(data)
    }
    return this.on(event, onceListener)
  },

  emit(this: any, event: string, data?: any) {
    const hasLocalListeners = (this._flags & HAS_EVENTS) && this._eventCounts[event]
    const hasWildcard = this._wildcardListeners?.size > 0
    const hasRealmBus = this._flags & HAS_REALM

    // Создаем eventData только если есть хотя бы один listener (lazy allocation)
    if (!hasLocalListeners && !hasWildcard && !hasRealmBus) {
      return this
    }

    const eventData = {
      id: this.id,
      value: this.value,
      data
    }

    // Локальные слушатели
    if (hasLocalListeners) {
      const listeners = this._events.get(event)!
      listeners.forEach(fn => fn(eventData))
    }

    // Wildcard слушатели текущего realm
    if (hasWildcard) {
      this._wildcardListeners.forEach(fn => fn({ event, ...eventData }))
    }

    // Emit в realm bus (если есть realm)
    if (hasRealmBus) {
      quantumBus.emit(this._realm, event, eventData)
    }

    return this
  },

  clear(this: any, event?: string) {
    if (event) {
      this._events?.delete(event)
      delete this._eventCounts?.[event]
    } else if (this._events) {
      this._events.clear()
      this._eventCounts = {}
      this._flags &= ~HAS_EVENTS
    }
    return this
  },

  pipe(this: any, fn: (value: any) => any) {
    this._pipeFn = fn
    return this
  },

  dedup(this: any, enable: boolean = true) {
    if (enable) {
      this._flags |= DEDUP
    } else {
      this._flags &= ~DEDUP
    }
    return this
  },

  stateless(this: any, enable: boolean = true) {
    if (enable) {
      this._flags |= STATELESS
    } else {
      this._flags &= ~STATELESS
    }
    return this
  },

  decay(this: any) {
    // Очистка listeners (массив)
    this.listeners = null

    // Очистка events
    this._events?.clear()

    // Очистка wildcard
    this._wildcardListeners?.clear()

    delete this.value
    this._flags = 0
  }
}

// Геттеры
Object.defineProperties(quarkProto, {
  hasListeners: {
    get(this: any) {
      return !!(this._flags & HAS_LISTENERS)
    },
    enumerable: true
  }
})
