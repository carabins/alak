/**
 * Quantum Bus - шина событий между realms
 */

type AnyFunction = (...args: any[]) => any

// Helper for safe execution
function safeEmit(fn: AnyFunction, arg: any) {
  try {
    fn(arg)
  } catch (e) {
    console.error('[QuantumBus] Error in listener:', e)
  }
}

/** Шина для конкретного realm */
let indexes = 0
export class RealmBus {
  private _events = new Map<string, Set<AnyFunction>>()
  // Scope -> Event -> Listeners
  private _scopes = new Map<string, Map<string, Set<AnyFunction>>>()

  private _wildcardListeners = new Set<AnyFunction>() // '*' - все события текущего realm
  private _eventCounts: Record<string, number> = {}
  public index = ++indexes
  public _realmName: string = ''

  hasListeners(event: string): boolean {
    return this._eventCounts[event] > 0
  }

  /**
   * Subscribe to events within a specific scope hierarchy
   * @param scope "user.1" matches events from "user.1" and "user.1.name"
   */
  onScope(scope: string, event: string, listener: AnyFunction) {
    let scopeMap = this._scopes.get(scope)
    if (!scopeMap) {
      scopeMap = new Map()
      this._scopes.set(scope, scopeMap)
    }

    let set = scopeMap.get(event)
    if (!set) {
      set = new Set()
      scopeMap.set(event, set)
    }
    set.add(listener)
    return this
  }

  offScope(scope: string, event: string, listener: AnyFunction) {
    const scopeMap = this._scopes.get(scope)
    if (scopeMap) {
      const set = scopeMap.get(event)
      if (set) {
        set.delete(listener)
        if (set.size === 0) scopeMap.delete(event)
      }
      if (scopeMap.size === 0) this._scopes.delete(scope)
    }
    return this
  }

  /**
   * Emit event in a specific scope with bubbling up.
   * "user.1.name" -> "user.1" -> "user" -> global
   */
  emitInScope(scope: string, event: string, data: any) {
    const parts = scope.split('.')


    // 1. Bubble up from specific scope to root
    for (let i = parts.length; i > 0; i--) {
      const currentScope = i === parts.length ? scope : parts.slice(0, i).join('.')
      const listeners = this._scopes.get(currentScope)?.get(event)

      if (listeners) {
        const eventObj = { event, data, scope: currentScope, originalScope: scope }
        listeners.forEach(fn => safeEmit(fn, eventObj))
      }
    }

    // 2. Notify Global Listeners (Once)
    // Global listeners effectively listen to ALL scopes
    const globalListeners = this._events.get(event)
    if (globalListeners) {
      const eventObj = { event, data, scope }
      globalListeners.forEach(fn => safeEmit(fn, eventObj))
    }

    // 3. Notify Wildcards (Once)
    if (this._wildcardListeners.size > 0) {
       const eventObj = { event, data, scope, realm: this._realmName }
       this._wildcardListeners.forEach(fn => safeEmit(fn, eventObj))
    }

    // 4. Notify Cross-Realm (if configured)
    if (this._realmName) {
      quantumBus.notifyCrossRealmSubscribers(this._realmName, event, data)
    }

    return this
  }

  on(event: string, listener: AnyFunction) {
    if (event === '*:*') {
      quantumBus.onWildcard(listener)
      return this
    }

    // Wildcard: '*' - все события текущего realm
    if (event === '*') {
      this._wildcardListeners.add(listener)
      return this
    }

    // Handle cross-realm event
    const colonIdx = event.indexOf(':')
    if (colonIdx > 0) {
      const realm = event.slice(0, colonIdx)
      const evt = event.slice(colonIdx + 1)
      quantumBus.subscribeToRealm(this._realmName, realm, evt, listener)
      return this
    }

    // Local event subscription
    let set = this._events.get(event)
    if (!set) {
      set = new Set()
      this._events.set(event, set)
      this._eventCounts[event] = 0
    }
    set.add(listener)
    this._eventCounts[event]++

    return this
  }

  off(event: string, listener?: AnyFunction) {
    // Handle wildcards
    if (event === '*:*') {
      quantumBus.offWildcard(listener)
      return this
    }

    if (event === '*') {
      if (listener) {
        this._wildcardListeners.delete(listener)
      } else {
        // If no listener specified, clear all wildcard listeners
        this._wildcardListeners.clear()
      }
      return this
    }

    // Handle cross-realm event
    const colonIdx = event.indexOf(':')
    if (colonIdx > 0) {
      const realm = event.slice(0, colonIdx)
      const evt = event.slice(colonIdx + 1)
      quantumBus.unsubscribeFromRealm(this._realmName, realm, evt)
      return this
    }

    // Handle local event
    if (listener) {
      const set = this._events.get(event)
      if (set?.delete(listener)) {
        this._eventCounts[event]--
        if (set.size === 0) {
          this._events.delete(event)
          delete this._eventCounts[event]
        }
      }
    } else {
      // If no listener specified, clear all listeners for this event
      this._events.delete(event)
      delete this._eventCounts[event]
    }

    return this // Return this for chaining
  }

  // Additional method to clear a specific event
  clearEvent(event: string) {
    this._events.delete(event)
    delete this._eventCounts[event]
  }

  emit(event: string, data: any) {
    // console.log(`emit [${event}] ${JSON.stringify(data)}`)

    // Emit to specific event listeners
    const listeners = this._events.get(event)
    if (listeners && listeners.size > 0) {
      const eventObj = { event, data }
      // Use safeEmit to ensure one error doesn't stop others
      listeners.forEach(fn => safeEmit(fn, eventObj))
    }

    // Emit to wildcard listeners (for this realm)
    if (this._wildcardListeners.size > 0) {
      const eventObj = { event, data, realm: this._realmName }  // Note: This might need to be an actual realm name
      this._wildcardListeners.forEach(fn => safeEmit(fn, eventObj))
    }

    // Notify cross-realm subscribers - notify those who are listening to THIS realm's events
    // Only notify if this realm has a name
    if (this._realmName) {
      quantumBus.notifyCrossRealmSubscribers(this._realmName, event, data);
    }

    // Broadcast to global wildcard listeners
    quantumBus.broadcast(event, data, this._realmName) // Pass realm info for *:* listeners
    return this // Return this for chaining
  }

  clear() {
    this._events.clear()
    this._wildcardListeners.clear()
    this._eventCounts = {}
  }
}

/** Quantum Bus - управление всеми realms */
class QuantumBusManager {
  private realms = new Map<string, RealmBus>()
  private wildcardListeners = new Set<AnyFunction>() // on('*:*')
  // Cross-realm subscriptions: key is "subscriberRealm:targetRealm:event", value is the listener
  private crossRealmSubscriptions = new Map<string, AnyFunction>()

  getRealm(realm: string): RealmBus {
    let bus = this.realms.get(realm)
    if (!bus) {
      bus = new RealmBus()
      bus._realmName = realm
      this.realms.set(realm, bus)
    }
    return bus
  }

  // Subscribe to events from another realm
  subscribeToRealm(subscriberRealm: string, targetRealm: string, event: string, listener: AnyFunction) {
    const key = `${subscriberRealm}:${targetRealm}:${event}`;
    this.crossRealmSubscriptions.set(key, listener);
  }

  // Unsubscribe from events from another realm
  unsubscribeFromRealm(subscriberRealm: string, targetRealm: string, event: string) {
    const key = `${subscriberRealm}:${targetRealm}:${event}`;
    this.crossRealmSubscriptions.delete(key);
  }

  // Notify cross-realm subscribers when target realm emits an event
  notifyCrossRealmSubscribers(targetRealm: string, event: string, data: any) {
    // Find all subscribers to this (targetRealm:event) combination
    for (const [key, listener] of this.crossRealmSubscriptions) {
      const [subscriberRealm, target, evt] = key.split(':');
      if (target === targetRealm && evt === event) {
        // Call the listener with wrapped data for consistency with regular events
        safeEmit(listener, { event, data });
      }
    }
  }

  /** Подписка на все события всех realms */
  onWildcard(listener: AnyFunction) {
    this.wildcardListeners.add(listener)
  }

  offWildcard(listener?: AnyFunction) {
    if (listener) {
      this.wildcardListeners.delete(listener)
    } else {
      // If no listener specified, clear all wildcard listeners
      this.wildcardListeners.clear()
    }
  }

  /** Emit с поддержкой wildcard слушателей */
  emit(realm: string, event: string, data: any) {
    // Emit в конкретный realm - используем getRealm для создания если нужно
    const realmBus = this.getRealm(realm)
    realmBus.emit(event, data)

    // Emit wildcard listeners (only for quantumBus-level wildcards)
    if (this.wildcardListeners.size > 0) {
      const wildcardData = { realm, event, data }
      this.wildcardListeners.forEach(fn => safeEmit(fn, wildcardData))
    }
  }
  broadcast (event: string, data: any, realmName?: any) {
    if (this.wildcardListeners.size > 0) {
      const wildcardData = { event, data, realm: realmName }
      this.wildcardListeners.forEach(fn => safeEmit(fn, wildcardData))
    }
  }

  hasListeners(realm: string, event: string): boolean {
    const realmBus = this.realms.get(realm)
    return realmBus ? realmBus.hasListeners(event) : false
  }
}

export const quantumBus = new QuantumBusManager()
