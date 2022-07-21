import { isDefined } from './extra'
import { eternalSym } from '@alaq/atom/property'

export default function (model) {
  const isClass = typeof model === 'function'
  const getters = {}
  const actions = {}
  const eternals = []
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
      // checkValue(key, instance[key])
      instaValues[key] = instance[key]
    })
  } else {
    Object.keys(model).forEach((key) => {
      const someValue = model[key]
      if (typeof someValue === 'function') {
        actions[key] = someValue
      } else {
        instaValues[key] = someValue
        // checkValue(key, someValue)
      }
    })
  }
  return {
    getters,
    actions,
    eternals,
    instaValues,
  }
}
