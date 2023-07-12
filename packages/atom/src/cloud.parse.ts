export default function (model, config: AtomOptions<any>) {
  const isClass = typeof model === 'function'
  const getters = {}
  const actions = {}
  const saveds = []
  const instaValues = {}

  if (isClass) {
    const instance = new model(config.constructorArgs)
    const findExtends = (prototype) => {
      const n = Object.getOwnPropertyNames(prototype)
      if (n.indexOf('__proto__') === -1) {
        n.forEach((key) => {
          if (key === 'constructor') {
            return
          }
          const opd = Object.getOwnPropertyDescriptor(prototype, key)
          if (opd.get) {
            getters[key] = opd.get
          } else {
            actions[key] = instance[key]
          }
        })
        const np = Object.getPrototypeOf(prototype)
        if (np) findExtends(np)
      }
    }
    findExtends(model.prototype)

    Object.keys(instance).forEach((key) => {
      instaValues[key] = instance[key]
    })
  } else {
    Object.keys(model).forEach((key) => {
      const someValue = model[key]
      if (typeof someValue === 'function') {
        actions[key] = someValue
      } else {
        instaValues[key] = someValue
      }
    })
  }
  return {
    getters,
    actions,
    saveds,
    instaValues,
  }
}
