// import {installNucleonExtension} from "@alaq/nucleus/create";
import {storage} from './storage'

import N from '@alaq/nucleus/index'
import {savedSym, tagSym, statelessSym, mixedSym} from '@alaq/atom/property'
import isDefined from '@alaq/rune/isDefined'

const nonNucleons = ['constructor']
export default function (key, valence, core: IDeepAtomCore<any>) {
  let nucleon: INucleus<any> = core.nucleons[key]
  if (!nucleon && !nonNucleons.includes(key)) {
    const id = core.name ? `${core.name}.${key}` : key
    let modelValue, metaValue, mem, tag
    mem = core.saved
    core.nucleons[key] = nucleon = N()

    if (valence) {
      let v = valence[key]
      delete valence[key]
      if (isDefined(v)) {
        let findSomeOne = false
        const defineRune = mv => {
          switch (mv?.sym) {
            case mixedSym:
              findSomeOne = true
              mv.mix.forEach(v => {
                if (v?.paked) {
                  defineRune(v())
                } else {
                  modelValue = v
                }
              })
              return
            case tagSym:
              findSomeOne = true
              tag = mv.tag || true
              break
            case savedSym:
              findSomeOne = true
              mem = true
              break
            case statelessSym:
              findSomeOne = true
              nucleon.stateless()
              break
          }
          if (findSomeOne && isDefined(mv.startValue)) {
            modelValue = mv.startValue
          }
        }
        if (v.sym) {
          defineRune(v)
          if (!findSomeOne) {
            modelValue = v
          }
        } else {
          modelValue = v
        }
        // if (isDefined(mv.startValue))
        //   modelValue = mv.startValue
      }

      // isDefined(modelValue) && defineRune(modelValue)


    }

    // if (typeof core.saved === 'boolean') {
    //   mem = core.saved
    // } else {
    //   mem = core.saved && core.saved.indexOf(key) !== -1
    // }


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
        core.quarkBus.dispatchEvent('NUCLEUS_CHANGE', {
          key,
          value,
          atomId: core.name,
          n: nucleon,
        })
      })
    }

    core.quarkBus.dispatchEvent('NUCLEUS_INIT', {tag, nucleus: nucleon})
  }
  return nucleon
}
