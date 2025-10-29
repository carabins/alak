/**
 * Quantum Bus - шина событий между realms
 */

type AnyFunction = (...args: any[]) => any

/** Шина для конкретного realm */
class RealmBus {
  private _events = new Map<string, Set<AnyFunction>>()
  private _eventCounts: Record<string, number> = {}

  hasListeners(event: string): boolean {
    return this._eventCounts[event] > 0
  }

  on(event: string, listener: AnyFunction) {
    let set = this._events.get(event)
    if (!set) {
      set = new Set()
      this._events.set(event, set)
      this._eventCounts[event] = 0
    }
    set.add(listener)
    this._eventCounts[event]++
  }

  off(event: string, listener: AnyFunction) {
    const set = this._events.get(event)
    if (set?.delete(listener)) {
      this._eventCounts[event]--
      if (set.size === 0) {
        this._events.delete(event)
        delete this._eventCounts[event]
      }
    }
  }

  emit(event: string, data: any) {
    const listeners = this._events.get(event)
    if (listeners && listeners.size > 0) {
      listeners.forEach(fn => fn(data))
    }
  }

  clear() {
    this._events.clear()
    this._eventCounts = {}
  }
}

/** Quantum Bus - управление всеми realms */
class QuantumBusManager {
  private realms = new Map<string, RealmBus>()
  private wildcardListeners = new Set<AnyFunction>() // on('*:*')

  getRealm(realm: string): RealmBus {
    let bus = this.realms.get(realm)
    if (!bus) {
      bus = new RealmBus()
      this.realms.set(realm, bus)
    }
    return bus
  }

  /** Подписка на все события всех realms */
  onWildcard(listener: AnyFunction) {
    this.wildcardListeners.add(listener)
  }

  offWildcard(listener: AnyFunction) {
    this.wildcardListeners.delete(listener)
  }

  /** Emit с поддержкой wildcard слушателей */
  emit(realm: string, event: string, data: any) {
    // Emit в конкретный realm - используем getRealm для создания если нужно
    const realmBus = this.getRealm(realm)
    realmBus.emit(event, data)

    // Emit wildcard listeners
    if (this.wildcardListeners.size > 0) {
      const wildcardData = { realm, event, data }
      this.wildcardListeners.forEach(fn => fn(wildcardData))
    }
  }

  hasListeners(realm: string, event: string): boolean {
    const realmBus = this.realms.get(realm)
    return realmBus ? realmBus.hasListeners(event) : false
  }
}

export const quantumBus = new QuantumBusManager()
