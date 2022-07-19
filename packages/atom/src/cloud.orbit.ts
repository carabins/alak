/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import create from './create'

import cloudGetters from './cloud.getters'
import { cloudProxy } from './cloud.proxy'
import { eternalAtom } from '@alaq/atom/index'
import CloudElectrons from './cloud.electrons'

export default function (electrons: CloudElectrons, cloud, name) {
  const l1 = create(electrons.instaValues).name(name)
  // prettier-ignore
  const l2 = cloud.superEternal
    ? l1.eternals()
    : electrons.eternalKeys?.length
      ? l1.eternals(...electrons.eternalKeys)
      : l1
  const atom = l2.one()

  const state = cloudProxy.state(atom)
  const thisContext = cloudProxy.warp(cloud.actions, state)
  const sleepingNucleons = cloudGetters(electrons, name)

  Object.assign(cloud.sleepingNucleons, sleepingNucleons)

  Object.keys(electrons.actions).forEach((key) => {
    cloud.actions[key] = (...args) => {
      const fn = electrons.actions[key] as Function
      fn.apply(thisContext, args)
    }
  })
  return { atom, state, sleepingNucleons, parts: electrons }
}
