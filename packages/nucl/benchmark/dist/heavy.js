// ../quark/src/flags.ts
var HAS_LISTENERS = 1;
var HAS_EVENTS = 2;
var HAS_REALM = 4;
var WAS_SET = 8;
var DEDUP = 16;
var STATELESS = 32;
var SILENT = 64;

// ../quark/src/quantum-bus.ts
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

// ../quark/src/prototype.ts
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

// ../quark/src/create.ts
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
// ../quark/src/index.ts
var Qv = Object.assign(function(value, options) {
  return createQu({ ...options, value });
});

// src/index.ts
var registry = {
  plugins: new Map,
  createHooks: [],
  decayHooks: []
};
function use(plugin) {
  if (registry.plugins.has(plugin.name)) {
    return;
  }
  registry.plugins.set(plugin.name, plugin);
  if (plugin.methods) {
    Object.assign(NuclProto, plugin.methods);
  }
  if (plugin.properties) {
    Object.keys(plugin.properties).forEach((key) => {
      Object.defineProperty(NuclProto, key, plugin.properties[key]);
    });
  }
  if (plugin.onCreate) {
    registry.createHooks.push(plugin.onCreate);
  }
  if (plugin.onDecay) {
    registry.decayHooks.push(plugin.onDecay);
  }
  plugin.onInstall?.();
}
var NuclProto = Object.create(quarkProto);
var originalDecay = NuclProto.decay;
NuclProto.decay = function() {
  registry.decayHooks.forEach((hook) => hook(this));
  return originalDecay.call(this);
};
var uidCounter2 = 0;
function Nucl(options) {
  const opts = options !== null && typeof options === "object" && "value" in options ? options : { value: options };
  const nucl = function(value) {
    return setValue(nucl, value);
  };
  nucl.uid = ++uidCounter2;
  nucl._flags = 0;
  if (opts.value !== undefined) {
    nucl.value = opts.value;
  }
  if (opts.id) {
    nucl.id = opts.id;
  }
  if (opts.realm) {
    nucl._realm = opts.realm;
    nucl._realmPrefix = opts.realm + ":";
    nucl._flags |= HAS_REALM;
  }
  if (opts.pipe) {
    nucl._pipeFn = opts.pipe;
  }
  if (opts.dedup) {
    nucl._flags |= DEDUP;
  }
  if (opts.stateless) {
    nucl._flags |= STATELESS;
  }
  Object.setPrototypeOf(nucl, NuclProto);
  for (let i = 0, len = registry.createHooks.length;i < len; i++) {
    registry.createHooks[i](nucl);
  }
  return nucl;
}

// src/nucleus/index.ts
function isEmpty(value) {
  if (value == null)
    return true;
  if (typeof value === "string")
    return value.length === 0;
  if (Array.isArray(value))
    return value.length === 0;
  if (typeof value === "object")
    return Object.keys(value).length === 0;
  if (typeof value === "number")
    return value === 0 || isNaN(value);
  if (typeof value === "boolean")
    return !value;
  return false;
}
var nucleusPlugin = {
  name: "nucleus",
  methods: {
    upSome(fn) {
      return this.up((value) => {
        if (value)
          fn(value, this);
      });
    },
    injectTo(obj) {
      const nucl = this;
      Object.defineProperty(obj, nucl.id || "value", {
        get() {
          return nucl.value;
        },
        set(v) {
          nucl(v);
        },
        enumerable: true,
        configurable: true
      });
      return this;
    },
    injectAs(key, obj) {
      const nucl = this;
      Object.defineProperty(obj, key, {
        get() {
          return nucl.value;
        },
        set(v) {
          nucl(v);
        },
        enumerable: true,
        configurable: true
      });
      return this;
    },
    push(...items) {
      if (!Array.isArray(this.value)) {
        throw new TypeError("push() requires array value");
      }
      const newValue = [...this.value, ...items];
      this(newValue);
      return this;
    },
    pop() {
      if (!Array.isArray(this.value)) {
        throw new TypeError("pop() requires array value");
      }
      const arr = [...this.value];
      const last = arr.pop();
      this(arr);
      return last;
    },
    map(fn) {
      if (!Array.isArray(this.value)) {
        throw new TypeError("map() requires array value");
      }
      const mapped = Nucl(this.value.map(fn));
      this.up((value) => {
        mapped(value.map(fn));
      });
      return mapped;
    },
    filter(fn) {
      if (!Array.isArray(this.value)) {
        throw new TypeError("filter() requires array value");
      }
      const filtered = Nucl(this.value.filter(fn));
      this.up((value) => {
        filtered(value.filter(fn));
      });
      return filtered;
    },
    find(fn) {
      if (!Array.isArray(this.value)) {
        throw new TypeError("find() requires array value");
      }
      return this.value.find(fn);
    },
    at(index) {
      if (!Array.isArray(this.value)) {
        throw new TypeError("at() requires array value");
      }
      return this.value.at(index);
    },
    set(key, val) {
      if (typeof this.value !== "object" || this.value === null) {
        throw new TypeError("set() requires object value");
      }
      const newValue = { ...this.value, [key]: val };
      this(newValue);
      return this;
    },
    get(key) {
      if (typeof this.value !== "object" || this.value === null) {
        throw new TypeError("get() requires object value");
      }
      return this.value[key];
    },
    pick(...keys) {
      if (typeof this.value !== "object" || this.value === null) {
        throw new TypeError("pick() requires object value");
      }
      const pickKeys = (obj) => {
        const result = {};
        keys.forEach((k) => {
          if (k in obj)
            result[k] = obj[k];
        });
        return result;
      };
      const picked = Nucl(pickKeys(this.value));
      this.up((value) => {
        picked(pickKeys(value));
      });
      return picked;
    },
    omit(...keys) {
      if (typeof this.value !== "object" || this.value === null) {
        throw new TypeError("omit() requires object value");
      }
      const omitKeys = (obj) => {
        const result = { ...obj };
        keys.forEach((k) => delete result[k]);
        return result;
      };
      const omitted = Nucl(omitKeys(this.value));
      this.up((value) => {
        omitted(omitKeys(value));
      });
      return omitted;
    }
  },
  properties: {
    isEmpty: {
      get() {
        return isEmpty(this.value);
      },
      enumerable: true
    },
    size: {
      get() {
        return Array.isArray(this.value) ? this.value.length : undefined;
      },
      enumerable: true
    },
    keys: {
      get() {
        return typeof this.value === "object" && this.value !== null ? Object.keys(this.value) : [];
      },
      enumerable: true
    },
    values: {
      get() {
        return typeof this.value === "object" && this.value !== null ? Object.values(this.value) : [];
      },
      enumerable: true
    }
  }
};
use(nucleusPlugin);

// src/fusion/index.ts
var strategies = {
  alive: (sources) => {
    return sources.every((s) => !!s.value);
  },
  any: (_sources) => {
    return true;
  }
};
function createFusionWithStrategy(sources, fn, strategy) {
  const result = Nucl(undefined);
  const compute = () => {
    if (strategy(sources)) {
      const values = sources.map((s) => s.value);
      const newValue = fn(...values);
      result(newValue);
    }
  };
  compute();
  const cleanups = [];
  let skipCount = sources.length;
  sources.forEach((source) => {
    const listener = () => {
      if (skipCount > 0) {
        skipCount--;
        return;
      }
      compute();
    };
    source.up(listener);
    cleanups.push(() => source.down(listener));
  });
  sources.forEach((source) => {
    const originalDecay2 = source.decay;
    source.decay = function() {
      cleanups.forEach((c) => c());
      result.decay();
      return originalDecay2.call(this);
    };
  });
  return result;
}
function Fusion(...args) {
  const fn = args[args.length - 1];
  const sources = args.slice(0, -1);
  return createFusionWithStrategy(sources, fn, strategies.alive);
}

class NeoFusionBuilder {
  sources;
  constructor(sources) {
    this.sources = sources;
  }
  alive(fn) {
    return createFusionWithStrategy(this.sources, fn, strategies.alive);
  }
  any(fn) {
    return createFusionWithStrategy(this.sources, fn, strategies.any);
  }
}
function NeoFusion(...sources) {
  return new NeoFusionBuilder(sources);
}
function createEffectWithStrategy(sources, fn, strategy) {
  const runEffect = () => {
    if (strategy(sources)) {
      const values = sources.map((s) => s.value);
      fn(...values);
    }
  };
  runEffect();
  const listeners = [];
  let skipCount = sources.length;
  sources.forEach((source) => {
    const listener = () => {
      if (skipCount > 0) {
        skipCount--;
        return;
      }
      runEffect();
    };
    source.up(listener);
    listeners.push({ source, listener });
  });
  return () => {
    listeners.forEach(({ source, listener }) => {
      source.down(listener);
    });
  };
}
function AliveFusion(sources, fn) {
  return createEffectWithStrategy(sources, fn, strategies.alive);
}
function AnyFusion(sources, fn) {
  return createEffectWithStrategy(sources, fn, strategies.any);
}

// src/heavy/index.ts
use(nucleusPlugin);
function HeavyNucl(options) {
  return Nucl(options);
}
Object.setPrototypeOf(HeavyNucl, Nucl);
export {
  use,
  nucleusPlugin,
  Nucl,
  NeoFusion,
  HeavyNucl,
  Fusion,
  AnyFusion,
  AliveFusion
};
