"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get Q () {
        return Q;
    },
    get QuarkEventBus () {
        return QuarkEventBus;
    }
});
const _events = require("@alaq/nucleus/events");
function removeEverythingListener(q, l) {
    var _q_everythingListeners;
    if ((_q_everythingListeners = q.everythingListeners) === null || _q_everythingListeners === void 0 ? void 0 : _q_everythingListeners.has(l)) {
        q.everythingListeners.delete(l);
    }
}
function addEverythingListener(q, listener) {
    if (!q.everythingListeners) q.everythingListeners = new Set();
    q.everythingListeners.add(listener);
}
const handlers = {
    decay (q) {
        const clearSet = (l)=>{
            l && l.forEach(l.delete);
        };
        clearSet(q.buses);
        clearSet(q.everythingListeners);
        q.stateListeners && q.stateListeners.forEach((v, k)=>q.stateListeners.delete(k));
    },
    addEverythingListener,
    addEventListener: (q, event, listener)=>(0, _events.addEventListener)(q, event, listener),
    removeEventListener: (q, event, listener)=>{
        (0, _events.removeEventListener)(q, event, listener);
    },
    removeListener: (q, listener)=>{
        (0, _events.removeListener)(q, listener);
        removeEverythingListener(q, listener);
    },
    dispatchEvent: (q, event, data)=>{
        if (q.everythingListeners) {
            q.everythingListeners.forEach((f)=>f(event, data));
        }
        (0, _events.dispatchEvent)(q, event, data);
    },
    getListenersMap: (q)=>{
        if (!q.stateListeners) q.stateListeners = new Map();
        return q.stateListeners;
    },
    addEventToBus (q, event, bus) {
        const connector = (v)=>bus.dispatchEvent(event, v);
        (0, _events.addEventListener)(q, event, connector);
        return connector;
    },
    removeEventToBus (q, connector) {
        (0, _events.removeListener)(q, connector);
    },
    addBus (q, bus) {
        if (!q.buses) q.buses = new Set();
        if (!q.buses.has(bus)) {
            q.buses.add(bus);
            addEverythingListener(q, bus.dispatchEvent);
        }
    },
    removeBus (q, bus) {
        var _q_buses;
        if ((_q_buses = q.buses) === null || _q_buses === void 0 ? void 0 : _q_buses.has(bus)) {
            q.buses.delete(bus);
            removeEverythingListener(q, bus.dispatchEvent);
        }
    }
};
const proxyHandler = {
    get (q, key) {
        const h = handlers[key];
        if (h) {
            return (...a)=>h(q, ...a);
        }
        console.error(key, '404', q);
        return q[key];
    }
};
function QuarkEventBus(id) {
    return new Proxy({
        id
    }, proxyHandler);
}
const Q = QuarkEventBus;
