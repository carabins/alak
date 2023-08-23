import {rnd} from "@alaq/nucleus/utils";
import {addEventListener, dispatchEvent, removeEventListener, removeListener} from "@alaq/nucleus/events";

export function QuarkEventBus(id?) {
    const q = {} as any
    const removeEverythingListener = (l) => {
        if (q.everythingListeners?.has(l)) {
            q.everythingListeners.delete(l)
        }
    }
    function addEverythingListener(listener) {
        if (!q.everythingListeners) q.everythingListeners = new Set()
        q.everythingListeners.add(listener)
    }
    return {
        id: id | rnd(),
        addEverythingListener,
        addEventListener: (event: string, listener) => addEventListener(q, event, listener),
        removeEventListener: (listener, event) => {
            removeEverythingListener(listener)
            removeEventListener(q, event, listener)
        },
        removeListener: (listener) => {
            removeListener(q, listener)
            removeEverythingListener(listener)
        },
        dispatchEvent: (event: string, data) => {
            if (q.everythingListeners) {
                q.everythingListeners.forEach((f) => f(event, data))
            }
            dispatchEvent(q, event, data)
        },
        getListenersMap: () => {
            if (!q.stateListeners) q.stateListeners = new Map()
            return q.stateListeners
        },
        addEventToBus(event: string, bus: QuarkBus<any, any>):Function {
            const connector = (v) => bus.dispatchEvent(event, v)
            addEventListener(q, event, connector)
            return connector
        },
        removeEventToBus(connector:Function) {
            removeListener(q, connector)
        },
        addBus(bus:QuarkBus<any, any>) {
            if (!q.buses) q.buses = new Set()
            if (!q.buses.has(bus)){
                q.buses.add(bus)
                addEverythingListener(bus.dispatchEvent)
            }
        },
        removeBus(bus){
            if (q.buses?.has(bus)){
                q.buses.delete(bus)
                removeEverythingListener(bus.dispatchEvent)
            }
        }
    } as QuarkBus<any, any>
}

export const Q = QuarkEventBus
