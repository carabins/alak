import {rnd} from "@alaq/nucleus/utils";
import {addEventListener, dispatchEvent, removeEventListener, removeListener} from "@alaq/nucleus/events";


function removeEverythingListener(q, l) {
  if (q.everythingListeners?.has(l)) {
    q.everythingListeners.delete(l)
  }
}

function addEverythingListener(q, listener) {
  if (!q.everythingListeners) q.everythingListeners = new Set()
  q.everythingListeners.add(listener)
}


const handlers = {
  decay(q) {
    const clearSet = (l: any) => {
      l && l.forEach(l.delete);
    }
    clearSet(q.buses)
    clearSet(q.everythingListeners)
    q.stateListeners && q.stateListeners.forEach((v, k) => q.stateListeners.delete(k))
  },
  addEverythingListener,
  addEventListener: (q, event, listener) => addEventListener(q, event, listener),
  removeEventListener: (q, event: string, listener) => {
    removeEventListener(q, event, listener)
  },
  removeListener: (q, listener) => {
    removeListener(q, listener)
    removeEverythingListener(q,listener)
  },
  dispatchEvent: (q, event: string, data) => {
    if (q.everythingListeners) {
      q.everythingListeners.forEach((f) => f(event, data))
    }
    dispatchEvent(q, event, data)
  },
  getListenersMap: (q,) => {
    if (!q.stateListeners) q.stateListeners = new Map()
    return q.stateListeners
  },
  addEventToBus(q,event: string, bus: IQuarkBus<any, any>): Function {
    const connector = (v) => bus.dispatchEvent(event, v)
    addEventListener(q, event, connector)
    return connector
  },
  removeEventToBus(q, connector: Function) {
    removeListener(q, connector)
  },
  addBus(q, bus: IQuarkBus<any, any>) {
    if (!q.buses) q.buses = new Set()
    if (!q.buses.has(bus)) {
      q.buses.add(bus)
      addEverythingListener(q,bus.dispatchEvent)
    }
  },
  removeBus(q, bus) {
    if (q.buses?.has(bus)) {
      q.buses.delete(bus)
      removeEverythingListener(q, bus.dispatchEvent)
    }
  }
}
type Q = {
  id: string
  buses: Set<any>
  everythingListeners: Set<any>
  stateListeners: Map<any, any>
}
const proxyHandler = {
  get(q: Q, key: string): any {
    const h = handlers[key]
    if (h) {
      return (...a) => h(q, ...a)
    }
    console.error(key, "404", q)
    return q[key]
  }
}

export function QuarkEventBus(id?: string) {
  return new Proxy({id} as any, proxyHandler) as IQuarkBus<any, any>
}

export const Q = QuarkEventBus
