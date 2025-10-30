// src/flags.ts
var HAS_LISTENERS = 1;
var HAS_EVENTS = 2;
var HAS_REALM = 4;
var WAS_SET = 8;
var DEDUP = 16;
var STATELESS = 32;
var SILENT = 64;

// src/quantum-bus.ts
class RealmBus {
  _events = new Map;
  _eventCounts = {};
  hasListeners(event) {
    return this._eventCounts[event] > 0;
  }
  on(event, listener) {
    let set = this._events.get(event);
    if (!set) {
      set = new Set;
      this._events.set(event, set);
      this._eventCounts[event] = 0;
    }
    set.add(listener);
    this._eventCounts[event]++;
  }
  off(event, listener) {
    const set = this._events.get(event);
    if (set?.delete(listener)) {
      this._eventCounts[event]--;
      if (set.size === 0) {
        this._events.delete(event);
        delete this._eventCounts[event];
      }
    }
  }
  emit(event, data) {
    const listeners = this._events.get(event);
    if (listeners && listeners.size > 0) {
      listeners.forEach((fn) => fn(data));
    }
  }
  clear() {
    this._events.clear();
    this._eventCounts = {};
  }
}

class QuantumBusManager {
  realms = new Map;
  wildcardListeners = new Set;
  getRealm(realm) {
    let bus = this.realms.get(realm);
    if (!bus) {
      bus = new RealmBus;
      this.realms.set(realm, bus);
    }
    return bus;
  }
  onWildcard(listener) {
    this.wildcardListeners.add(listener);
  }
  offWildcard(listener) {
    this.wildcardListeners.delete(listener);
  }
  emit(realm, event, data) {
    const realmBus = this.getRealm(realm);
    realmBus.emit(event, data);
    if (this.wildcardListeners.size > 0) {
      const wildcardData = { realm, event, data };
      this.wildcardListeners.forEach((fn) => fn(wildcardData));
    }
  }
  hasListeners(realm, event) {
    const realmBus = this.realms.get(realm);
    return realmBus ? realmBus.hasListeners(event) : false;
  }
}
var quantumBus = new QuantumBusManager;

// src/prototype.ts
var quarkProto = {
  up(listener) {
    if (!this.listeners) {
      this.listeners = [];
      this._flags |= HAS_LISTENERS;
    }
    this.listeners.push(listener);
    if (this.value !== undefined) {
      listener(this.value, this);
    }
    return this;
  },
  down(listener) {
    if (this.listeners) {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
        if (this.listeners.length === 0) {
          this._flags &= ~HAS_LISTENERS;
        }
      }
    }
    return this;
  },
  silent(value) {
    this._flags |= SILENT;
    Reflect.apply(this, null, [value]);
    this._flags &= ~SILENT;
    return this;
  },
  on(event, listener) {
    if (event === "*:*") {
      quantumBus.onWildcard(listener);
      return this;
    }
    if (event === "*") {
      if (this._flags & HAS_REALM) {
        const realmBus = quantumBus.getRealm(this._realm);
        if (!this._wildcardListeners) {
          this._wildcardListeners = new Set;
        }
        this._wildcardListeners.add(listener);
      }
      return this;
    }
    const colonIdx = event.indexOf(":");
    if (colonIdx > 0) {
      const realm = event.slice(0, colonIdx);
      const evt = event.slice(colonIdx + 1);
      const realmBus = quantumBus.getRealm(realm);
      realmBus.on(evt, listener);
      return this;
    }
    if (!(this._flags & HAS_EVENTS)) {
      this._events = new Map;
      this._eventCounts = {};
      this._flags |= HAS_EVENTS;
    }
    let set = this._events.get(event);
    if (!set) {
      set = new Set;
      this._events.set(event, set);
      this._eventCounts[event] = 0;
    }
    set.add(listener);
    this._eventCounts[event]++;
    return this;
  },
  off(event, listener) {
    if (event === "*:*") {
      quantumBus.offWildcard(listener);
      return this;
    }
    if (event === "*") {
      this._wildcardListeners?.delete(listener);
      return this;
    }
    const colonIdx = event.indexOf(":");
    if (colonIdx > 0) {
      const realm = event.slice(0, colonIdx);
      const evt = event.slice(colonIdx + 1);
      const realmBus = quantumBus.getRealm(realm);
      realmBus.off(evt, listener);
      return this;
    }
    const set = this._events?.get(event);
    if (set?.delete(listener)) {
      this._eventCounts[event]--;
      if (set.size === 0) {
        this._events.delete(event);
        delete this._eventCounts[event];
        if (this._events.size === 0) {
          this._flags &= ~HAS_EVENTS;
        }
      }
    }
    return this;
  },
  once(event, listener) {
    const onceListener = (data) => {
      this.off(event, onceListener);
      listener(data);
    };
    return this.on(event, onceListener);
  },
  emit(event, data) {
    const hasLocalListeners = this._flags & HAS_EVENTS && this._eventCounts[event];
    const hasWildcard = this._wildcardListeners?.size > 0;
    const hasRealmBus = this._flags & HAS_REALM;
    if (!hasLocalListeners && !hasWildcard && !hasRealmBus) {
      return this;
    }
    const eventData = {
      id: this.id,
      value: this.value,
      data
    };
    if (hasLocalListeners) {
      const listeners = this._events.get(event);
      listeners.forEach((fn) => fn(eventData));
    }
    if (hasWildcard) {
      this._wildcardListeners.forEach((fn) => fn({ event, ...eventData }));
    }
    if (hasRealmBus) {
      quantumBus.emit(this._realm, event, eventData);
    }
    return this;
  },
  clear(event) {
    if (event) {
      this._events?.delete(event);
      delete this._eventCounts?.[event];
    } else if (this._events) {
      this._events.clear();
      this._eventCounts = {};
      this._flags &= ~HAS_EVENTS;
    }
    return this;
  },
  pipe(fn) {
    this._pipeFn = fn;
    return this;
  },
  dedup(enable = true) {
    if (enable) {
      this._flags |= DEDUP;
    } else {
      this._flags &= ~DEDUP;
    }
    return this;
  },
  stateless(enable = true) {
    if (enable) {
      this._flags |= STATELESS;
    } else {
      this._flags &= ~STATELESS;
    }
    return this;
  },
  decay() {
    this.listeners = null;
    this._events?.clear();
    this._wildcardListeners?.clear();
    delete this.value;
    this._flags = 0;
  }
};
Object.defineProperties(quarkProto, {
  hasListeners: {
    get() {
      return !!(this._flags & HAS_LISTENERS);
    },
    enumerable: true
  }
});

// src/create.ts
var uidCounter = 0;
function setValue(quark, value) {
  const flags = quark._flags;
  if (quark._pipeFn) {
    const transformed = quark._pipeFn(value);
    if (transformed === undefined)
      return quark.value;
    value = transformed;
  }
  if (flags & DEDUP && quark.value === value) {
    return value;
  }
  const wasSet = flags & WAS_SET;
  if (!(flags & STATELESS)) {
    quark.value = value;
  }
  quark._flags |= WAS_SET;
  if (flags & SILENT) {
    return value;
  }
  if (!wasSet && flags & HAS_REALM) {
    quantumBus.emit(quark._realm, "QUARK_AWAKE", {
      id: quark.id,
      value,
      quark
    });
  }
  if (flags === WAS_SET)
    return value;
  if (flags === (HAS_LISTENERS | WAS_SET)) {
    const listeners = quark.listeners;
    for (let i = 0, len = listeners.length;i < len; i++) {
      listeners[i](value, quark);
    }
    return value;
  }
  if (flags & HAS_LISTENERS) {
    const listeners = quark.listeners;
    for (let i = 0, len = listeners.length;i < len; i++) {
      listeners[i](value, quark);
    }
  }
  if (flags & HAS_EVENTS && quark._eventCounts?.change) {
    const eventData = { id: quark.id, value };
    quark._events.get("change").forEach((fn) => fn(eventData));
  }
  if (flags & HAS_REALM) {
    if (quantumBus.hasListeners(quark._realm, "change")) {
      quantumBus.emit(quark._realm, "change", {
        id: quark.id,
        value,
        quark
      });
    }
  }
  return value;
}
function createQu(options) {
  const quark = function(value) {
    return setValue(quark, value);
  };
  quark.uid = ++uidCounter;
  quark._flags = 0;
  if (options?.value !== undefined) {
    quark.value = options.value;
  }
  if (options?.id) {
    quark.id = options.id;
  }
  if (options?.realm) {
    quark._realm = options.realm;
    quark._realmPrefix = options.realm + ":";
    quark._flags |= HAS_REALM;
  }
  if (options?.pipe) {
    quark._pipeFn = options.pipe;
  }
  if (options?.dedup) {
    quark._flags |= DEDUP;
  }
  if (options?.stateless) {
    quark._flags |= STATELESS;
  }
  Object.setPrototypeOf(quark, quarkProto);
  return quark;
}

// src/index.ts
var Qu = createQu;
var Qv = Object.assign(function(value, options) {
  return createQu({ ...options, value });
});
var src_default = Qu;
export {
  src_default as default,
  Qv,
  Qu
};
