import { isDefined } from './extra'

export default function (model) {
  const isClass = typeof model === 'function'
  const getters = {}
  const actions = {}
  const instaNucleons = []
  const instaValues = {}
  if (isClass) {
    const instance = new model()
    let protoOfInstance = Object.getPrototypeOf(instance)
    let methods = Object.getOwnPropertyNames(protoOfInstance)
    methods.forEach((key) => {
      let opd = Object.getOwnPropertyDescriptor(protoOfInstance, key)
      if (key === 'constructor') {
        return
      }
      if (opd.get) {
        getters[key] = opd.get
      } else {
        actions[key] = instance[key]
      }
    })
    Object.keys(instance).forEach((key) => {
      const startValue = instance[key]
      if (isDefined(startValue)) {
        instaValues[key] = startValue
      }
      instaNucleons.push(key)
    })
  } else {
    Object.keys(model).forEach((key) => {
      const someValue = model[key]
      if (typeof someValue === 'function') {
        actions[key] = someValue
      } else {
        instaValues[key] = someValue
        instaNucleons.push(key)
      }
    })
  }
  return {
    getters,
    actions,
    instaNucleons,
    instaValues,
  }
}
