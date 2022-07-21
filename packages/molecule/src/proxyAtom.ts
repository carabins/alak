import { atomicConstructor } from '@alaq/molecule/atomicConstructor'
import { Nucleus } from '@alaq/nucleus/index'

const publicKeys = {
  state: 1,
  core: 1,
  nodes: 1,
  actions: 1,
  emitEvent: 1,
}

export function proxyAtom(constructor, id?, patch?, t?) {
  const quantum: QuantumAtom = {
    target: t,
    id,
    activateListeners: [],
    ready: false,
    patched: false,
  }
  if (patch) {
    Object.assign(quantum, patch)
    quantum.patched = true
  }
  const up = () => {
    atomicConstructor(constructor, quantum)
    quantum.ready = true
  }
  const proxy = new Proxy(quantum, {
    get(target: any, p: string | symbol, receiver: any): any {
      if (publicKeys[p]) {
        if (quantum.ready) {
          return quantum.atom[p]
        } else if (quantum.patched) {
          quantum.ready = true
          up()
          return quantum.atom[p]
        } else {
          console.error('atom out of molecule', quantum)
        }
      }
      switch (p) {
        case 'patch':
          return (o) => {
            Object.assign(quantum, o)
            quantum.patched = true
            if (constructor.startup === 'immediately') {
              up()
            }
          }
        case 'onActivate':
          return (listener) => {
            target.activateListeners.push(listener)
          }
      }
    },
  })

  return proxy
}
