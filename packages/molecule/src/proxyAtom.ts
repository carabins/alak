import {atomicConstructor} from "@alaq/molecule/atomicConstructor";

const publicKeys = {
  state: 1,
  core: 1,
  nodes: 1,
  actions: 1,
  emitEvent: 1,
};

export function proxyAtom(constructor, id?, t?) {
  const quantum: QuantumAtom = {
    target: t,
    id,
    activateListeners: []
  }
  return new Proxy(quantum, {
    set(target: QuantumAtom, p: string | symbol, value: any, receiver: any): boolean {
      switch (p) {
        case "name":
        case "eventBus":
          quantum[p] = value
          return true
      }
      return false
    },
    get(target: any, p: string | symbol, receiver: any): any {
      if (publicKeys[p]) {
        if (!quantum.atom) {
          atomicConstructor(constructor, quantum)
        }
        return quantum.atom[p]
      }

      switch (p) {
        case "onActivate":
          return (listener) => {
            target.activateListeners.push(listener)
          }
      }
    }
  })
}






