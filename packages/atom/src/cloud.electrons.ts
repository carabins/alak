/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default class CloudElectrons {
  getters = {}
  actions = {}
  instaValues = {}
  savedKeys = []
  core: any
  state: any

  constructor(
    public getNucleon: AnyFunction,
    cloud,
  ) {
    this.core = new Proxy(
      {},
      {
        get(target: {}, p: any, receiver: any): any {
          let v = cloud.nucleons[p]
          if (v) return v
          v = cloud.actions[p]
          if (v) return v
          return getNucleon(p)
        },
      },
    )
  }

  addEternals(keys: String[]) {
    this.savedKeys.push(...keys)
  }
}
