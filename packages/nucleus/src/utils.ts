export const alive = (v) => (v !== undefined && v !== null) as boolean
export const isTruth = (v) => !!v
export const noneFilter = (f) => (v) => !alive(v) ? f(v) : null
export const someFilter = (f) => (v) => alive(v) ? f(v) : null
export const trueFilter = (f) => (v) => isTruth(v) ? f(v) : null
export const someFalseFilter = (f) => (v) => alive(v) && !isTruth(v) ? f(v) : null
export const falseFilter = (f) => (v) => !isTruth(v) ? f(v) : null
export const upDownFilter = (fun) => (f) => {
  const down = (a) => () => a.down(fun)
  return (v, a) => {
    f(v, down(a))
  }
}

// export const DECAY_QUARK_ERROR = 'Attempt to pass into the decayed quark'
// export const PROPERTY_ATOM_ERROR = 'undefined quark property'

export const deleteParams = (o) => {
  Object.keys(o).forEach((k) => {
    if (o[k]) o[k] = null
    delete o[k]
  })
}

export function isPromise(obj) {
  return (
    !!obj &&
    (typeof obj === 'object' || typeof obj === 'function') &&
    typeof obj.then === 'function'
  )
}

export const rnd = () => 1000000000000000 * (Math.ceil(Math.random() * 9) + Math.random())
