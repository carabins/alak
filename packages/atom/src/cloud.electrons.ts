/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

export default class CloudElectrons {
  getters = {}
  actions = {}
  instaValues = {}
  eternalKeys = []
  core: any
  state: any

  constructor(public getNucleon: AnyFunction, cloud) {
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
    this.state = new Proxy(
      {},
      {
        get(target: {}, p: any, receiver: any): any {
          // console.log('state', Object.keys(cluster.nucleons))

          let nucleon = cloud.nucleons[p]
          if (!nucleon) nucleon = getNucleon(p)
          return nucleon.value
        },
      },
    ) as any
  }
}
