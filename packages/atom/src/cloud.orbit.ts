/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import cloudGetters from './cloud.getters'
import { cloudProxy } from './cloud.proxy'
import CloudElectrons from './cloud.electrons'

export default function (electrons: CloudElectrons, cloud, config: AtomOptions<any>) {
  const atom = cloudProxy.nuclear(electrons.instaValues, Object.assign({ nucleons: {} }, config))

  const sleepingNucleons = cloudGetters(electrons, config.name)
  Object.assign(cloud.sleepingNucleons, sleepingNucleons)

  const state = cloudProxy.state(atom)
  const fullState = cloudProxy.warpNucleonGetter(electrons.getNucleon, state)
  const thisState = cloudProxy.warp(cloud.actions, fullState)
  const thisContext = config.thisExtension
    ? cloudProxy.warp(config.thisExtension, thisState)
    : thisState

  electrons.state = thisContext

  Object.keys(electrons.actions).forEach((key) => {
    cloud.actions[key] = (...args) => {
      const fn = electrons.actions[key] as Function
      return fn.apply(thisContext, args)
    }
  })
  return { atom }
}
