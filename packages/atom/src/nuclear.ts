// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'
import { isDefined } from './extra'
import N from '@alaq/nucleus/index'
import { savedSym, tracedSym, statelessSym } from '@alaq/atom/property'

const nonNucleons = ['constructor']
export default function (key, valence, core: DeepAtomCore<any>) {
  let nucleon: INucleus<any> = core.nucleons[key]
  if (!nucleon && !nonNucleons.includes(key)) {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue, mem, traced, broadcast

    if (valence) {
      let v = valence[key]
      if (isDefined(v)) {
        modelValue = v
        delete valence[key]
      }
    }

    if (typeof core.saved === 'boolean') {
      mem = core.saved
    } else {
      //@ts-ignore
      mem = core.saved && core.saved.indexOf(key) !== -1
    }
    core.nucleons[key] = nucleon = N()
    if (isDefined(modelValue)) {
      switch (modelValue.sym) {
        case tracedSym:
          traced = modelValue.traced || true
          modelValue = modelValue.startValue
          break
        case savedSym:
          modelValue = modelValue.startValue
          mem = true
          break
        case statelessSym:
          modelValue = modelValue.startValue
          mem = false
          break
      }
    }

    switch (core.nucleusStrategy) {
      case 'holistic':
        nucleon.holistic()
        break
      case 'stateless':
        nucleon.stateless()
        break
      case 'holystate':
        nucleon.holistic()
        nucleon.stateless()
        break
    }
    nucleon.setId(id)
    if (mem) {
      storage.init(nucleon)
      nucleon.isEmpty && isDefined(modelValue) && nucleon(modelValue)
    } else {
      if (isDefined(modelValue)) {
        nucleon(modelValue)
      }
    }

    if (core.emitChanges) {
      nucleon.up((value) => {
        core.quarkBus.dispatchEvent('NUCLEON_CHANGE', {
          key,
          value,
          core: core.name,
          nucleon,
        })
      })
    }

    core.quarkBus.dispatchEvent('NUCLEON_INIT', { traced, nucleon })
  }

  return nucleon
}
