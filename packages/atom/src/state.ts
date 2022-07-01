// @ts-nocheck
export const FState = {
  AWAIT: 'await',
  CLEAR: 'clear',
}
export const ClearState = {
  VALUE: 'value',
  ALL: 'all',
  DECAY: 'decay',
}

export function notifyStateListeners(core, state: string, ...value) {
  if (core.stateListeners && core.stateListeners.has(state)) {
    core.stateListeners.get(state).forEach((f) => f.apply(f, value))
  }
}

export function addStateEventListener(core, state, fun) {
  if (!core.stateListeners) core.stateListeners = new Map()
  if (!core.stateListeners.has(state)) {
    const set = new Set()
    set.add(fun)
    core.stateListeners.set(state, set)
  } else core.stateListeners.get(state).add(fun)
}

export function removeStateEventListener(core, state: string, fun) {
  if (core.stateListeners && core.stateListeners.has(state)) {
    const ase = core.stateListeners.get(state)
    if (ase.has(fun)) ase.delete(fun)
  }
}
