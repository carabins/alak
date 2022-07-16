export const QState = {
  AWAIT: 'await',
  CLEAR: 'clear',
}
export const ClearState = {
  VALUE: 'value',
  ALL: 'all',
  DECAY: 'decay',
}

export function notifyStateListeners(quark, state: string, ...value) {
  if (quark.stateListeners && quark.stateListeners.has(state)) {
    quark.stateListeners.get(state).forEach((f) => f.apply(f, value))
  }
}

export function addStateEventListener(quark, state, fun) {
  if (!quark.stateListeners) quark.stateListeners = new Map()
  if (!quark.stateListeners.has(state)) {
    const set = new Set()
    set.add(fun)
    quark.stateListeners.set(state, set)
  } else quark.stateListeners.get(state).add(fun)
}

export function removeStateEventListener(quark, state: string, fun) {
  if (quark.stateListeners && quark.stateListeners.has(state)) {
    const ase = quark.stateListeners.get(state)
    if (ase.has(fun)) ase.delete(fun)
  }
}
