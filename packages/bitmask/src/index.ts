import N from '@alaq/nucleus/index'
import { AlakBitMask } from './bitmask'
import { storage } from '@alaq/atom/storage'

export function bitmaskBuilder<T extends ReadonlyArray<string>, G extends GroupedBitKeys<T>>(
  items: T,
  groupItems?: G,
) {
  const masks = {} as BitKeysFromList<typeof items>
  const groups = {} as Record<keyof G, number>
  items.forEach((v, i) => {
    masks[v] = 1 << i
  })
  groupItems &&
    Object.keys(groupItems).forEach((k: keyof G) => {
      const a = groupItems[k]
      let gv = 0
      a.forEach((v) => {
        gv |= masks[v]
      })
      groups[k] = gv
    })
  const all = Object.assign({}, masks, groups)
  const bitmask = {
    masks,
    groups,
    all,
    stateBuilder,
  }

  const groupsKeys = Object.keys(groups)
  const affectedGroup = {} as Record<string, any>
  groupsKeys.forEach((gk) => {
    let gv = groupItems[gk]
    gv.forEach((m) => {
      if (affectedGroup[m]) {
        affectedGroup[m][gk] = true
      } else {
        affectedGroup[m] = { [gk]: true }
      }
    })
  })
  Object.keys(affectedGroup).forEach((k) => {
    affectedGroup[k] = Object.keys(affectedGroup[k])
  })

  function stateBuilder(startValue = 1, saveName?: string) {
    const flag = N(startValue)
    if (saveName) {
      flag.setId(saveName)
      storage.init(flag)
    }
    const mask = new AlakBitMask(flag.value, masks)
    const values = N({} as Record<keyof typeof masks | keyof typeof groups, boolean>)
    let listener
    const changes = (f) => {
      listener = f
    }

    const update = (flagNames) => {
      const o = Object.assign({}, affectedGroup, values.value) as Record<
        keyof typeof masks | keyof typeof groups,
        boolean
      >
      const afg = {}
      let v
      const check = (n) => {
        v = mask.is(all[n])
        if (v !== o[n]) {
          //@ts-ignore
          o[n] = v
          affectedGroup[n] &&
            affectedGroup[n].forEach((g) => {
              afg[g] = true
            })
          listener && listener(n, v)
        }
      }
      flagNames.forEach(check)
      Object.keys(afg).forEach(check)
      //@ts-ignore
      values.silent(o)
      flag(mask.flags)
      values.resend()
    }

    const state: StateController<typeof masks, typeof all> = {
      setTrue(...flagNames) {
        let up = false
        flagNames.forEach((flagName) => {
          if (mask.addFlag(flagName)) {
            up = true
          }
        })
        update(flagNames)
      },
      setFalse(...flagNames) {
        let up = false
        flagNames.forEach((flagName) => {
          if (mask.removeFlag(flagName)) {
            up = true
          }
        })
        up && update(flagNames)
      },
      toggle(...flagNames) {
        flagNames.forEach((flagName) => {
          mask.toggleFlag(flagName)
        })
        update(flagNames)
      },
      changes,
    }
    update(Object.keys(masks))
    return Object.assign(state, {
      values,
      flag,
      mask,
      enum: Object.assign(masks, groups),
      set(flags: number) {
        mask.flags = flags
        update(Object.keys(masks))
      },
    })
  }

  return bitmask
}
