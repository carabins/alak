/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import cloudOrbit from './cloud.orbit'
import cloudParse from './cloud.parse'
import CloudElectrons from './cloud.electrons'
import { is } from 'tap'

export default function <Model, Ethernal>(config: {
  name: string
  model?: Model
  eternal?: Ethernal | Array<keyof PureModel<Model>> | string
}) {
  const cloud = {
    nucleons: {},
    actions: {},
    sleepingNucleons: {},
    superEternal: false,
  }

  const electrons = new CloudElectrons(getNucleon, cloud)

  if (config.eternal === '*') {
    cloud.superEternal = true
  }
  if (config.eternal && typeof config.eternal[0] === 'string') {
    electrons.eternalKeys = config.eternal as string[]
  }

  const findElectrons = (model, isEternal?) => {
    const parts = cloudParse(model)
    Object.assign(electrons.actions, parts.actions)
    Object.assign(electrons.getters, parts.getters)
    Object.assign(electrons.instaValues, parts.instaValues)
    electrons.addEternals(parts.eternals)
    if (isEternal) {
      electrons.addEternals(Object.keys(parts.instaValues))
    }
  }

  config.model && findElectrons(config.model)
  config.eternal && findElectrons(config.eternal, true)

  const orbital = cloudOrbit(electrons, cloud, config.name)

  function getNucleon(key) {
    let nucleon = cloud.sleepingNucleons[key]
    if (nucleon) {
      const wakeup = nucleon.getMeta('sleep')
      wakeup()
      nucleon.deleteMeta('sleep')
      cloud.nucleons[key] = nucleon
      delete cloud.sleepingNucleons[key]
    } else {
      nucleon = orbital.atom[key]
    }
    return nucleon
  }

  return { core: electrons.core, state: electrons.state, actions: cloud.actions } as IAtom<Model>
}
