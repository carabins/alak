// import {installNucleonExtension} from "@alaq/nucleus/create";
import { storage } from './storage'

import N from '@alaq/nucleus/index'
import { savedSym, tagSym, statelessSym, mixedSym, finiteSym, wrapSym } from '@alaq/atom/property'
import isDefined from '@alaq/rune/isDefined'
import { coreAtom } from '@alaq/atom/index'

const nonNucleons = ['constructor']
export default function (key, valence, core: IDeepAtomCore<any>) {
  let nucleon: INucleus<any> = core.nucleons[key]
  if (!nucleon && !nonNucleons.includes(key) && typeof key == 'string') {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue, metaValue, mem
    mem = core.saved
    core.nucleons[key] = nucleon = N()

    if (valence) {
      let maybeValue = valence[key]
      delete valence[key]
      if (isDefined(maybeValue)) {
        const defineRune = (mv) => {
          switch (mv?.sym) {
            case tagSym:
              nucleon.addMeta('tag', mv.tag)
              break
            case savedSym:
              mem = true
              break
            case statelessSym:
              nucleon.stateless()
              break
            case finiteSym:
              nucleon.finite()
              break
            case wrapSym:
              nucleon.setWrapper(mv.wrapper)
              break
          }
          if (isDefined(mv.startValue)) {
            modelValue = mv.startValue
          }
        }
        switch (true) {
          case maybeValue.mix?.length > 1:
            maybeValue.mix.forEach((xv) => {
              switch (true) {
                case typeof xv == 'function':
                  defineRune(xv())
                  break
                case typeof xv.sym === 'symbol':
                  defineRune(xv)
                  break
                default:
                  modelValue = xv
              }
            })
            break
          case typeof maybeValue.sym === 'symbol':
            defineRune(maybeValue)
            break
          default:
            modelValue = maybeValue
        }
      }
    }

    switch (core.nucleusStrategy) {
      case 'finite':
        nucleon.finite()
        break
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

    if (core.metaMap) {
      const tags = core.metaMap[key]
      tags?.forEach(nucleon.addMeta)
    }
    if (!nucleon.hasMeta('no_bus')) {
      if (core.emitChanges) {
        nucleon.up((value) => {
          core.quarkBus.dispatchEvent('NUCLEUS_CHANGE', {
            key,
            value,
            atomId: core.name,
            n: nucleon,
          })
        })
      }
      core.quarkBus.dispatchEvent('NUCLEUS_INIT', nucleon)
    }
  }
  return nucleon
}
