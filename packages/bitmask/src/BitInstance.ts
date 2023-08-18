import BitWise from './BitWise'
import BitFlags from './BitFlags'
import IndexedVertexMap from "@alaq/datastruct/IndexedVertexMap";
import calcCombination from "@alaq/bitmask/calcCombination";


type EventListener = {
  event: string
  listener: Function
}

function getBalseState(v: IBitWise, flags, state = {}) {
  const affected = {}
  const newState = {}
  Object.keys(flags).forEach(flagName => {
    const nv = v.is(flags[flagName])
    newState[flagName] = nv
    if (state[flagName] !== nv) {
      affected[flagName] = nv
    }
  })
  return {state: newState, affected}
}

export default function BitInstance<
  F extends ReadonlyArray<string>,
  G extends FlagGroupKeys<F>,
  C extends BitInstanceConfigWises<F, G>,
>(config: BitInstanceConfig<F, G, C>) {
  const value = BitWise(config.startValue)
  const bitFlags = BitFlags(config.flags, config.groups)
  const all = {} as Record<string, number>
  const base = {} as Record<keyof RoArrayToRecord<F>, number>
  const haveCombinations = !!config.combinations

  config.flags.forEach(flagName => {
    base[flagName] = all[flagName] = bitFlags.values[flagName]
  })
  const groupAffectEdges = IndexedVertexMap<string, string>()
  config.groups && Object.keys(config.groups).forEach(flagName => {
    all[flagName] = bitFlags.values[flagName]
    config.groups[flagName].forEach(baseFlagName => {
      groupAffectEdges.push(baseFlagName, flagName)
    })
  })
  const combinationsAffectEdges = IndexedVertexMap<string, string>()
  if (haveCombinations) {
    Object.keys(config.combinations).forEach(cName => {
      const cOps = config.combinations[cName]
      Object.values(cOps).forEach((flags) => {
        flags.forEach((f: string) => combinationsAffectEdges.push(f, cName))
      })
    })
  }

  const flagListeners = IndexedVertexMap<string, EventListener>()
  let valueListeners = [] as EventListener[]

  const proxyFlagsActions = {
    is: f => bitFlags.wise[f].is,
    bitValue: f => bitFlags.values[f],
    state: f => bi.state[f],
    toggle: f => bitFlags.wise[f].toggle(bitFlags.values[f]),
    setTrue: f => () => bi.setTrue(f),
    setFalse: f => () => bi.setFalse(f),
    onValueUpdate: f => (event, listener) => {
      switch (event) {
        case "TRUE" :
          bi.state[f] && listener()
          break
        case "FALSE" :
          !bi.state[f] && listener()
          break
        default:
          listener()
      }
      return flagListeners.push(f, {
        event, listener
      })
    },
    removeValueUpdate: f => v => flagListeners.remove(f, v)
  }
  const proxyFlagsHandler = {
    get({flag}, key) {
      return proxyFlagsActions[key](flag)
    }
  }

  const proxyFlags = {}
  const bi = {
    state: {},
    bitwise: value,
    core: {
      allFlagValues: all,
      baseFlagValues: base
    },
    setFalse: (...flags) => value.remove(flags.map(f => all[f]).reduce((prev, now) => prev | now)),
    setTrue: (...flags) => value.add(flags.map(f => all[f]).reduce((prev, now) => prev | now)),
    removeValueUpdate(v) {
      valueListeners = valueListeners.filter(f => f !== v as any)
    },
    onValueUpdate(event, listener) {
      const o = {
        event, listener
      } as any
      valueListeners.push(o)
      return o
    },
    flags: new Proxy({}, {
      get(o, flag: any) {
        let v = proxyFlags[flag]
        if (!v) {
          v = proxyFlags[flag] = new Proxy({flag}, proxyFlagsHandler)
        }
        return v

      }
    })
  } as IBitInstance<F, G, C>

  const update = (vv) => {
    const baseChanges = getBalseState(value, base, bi.state)
    const affected = {}
    Object.keys(baseChanges.affected).forEach(baseFlag => {
      groupAffectEdges.forEach(baseFlag, groupFlag => {
        if (affected[groupFlag] === undefined) {
          affected[groupFlag] = value.is(all[groupFlag])
        }
      })
      if (haveCombinations) {
        combinationsAffectEdges.forEach(baseFlag, combinationName => {
          if (affected[combinationName] === undefined) {

            affected[combinationName] = calcCombination(config.combinations[combinationName], value, all)

          }
        })
      }
    })
    const allAffected = Object.assign(affected, baseChanges.affected)
    bi.state = Object.assign(bi.state, allAffected) as any


    Object.keys(allAffected).forEach(flag => {
      flagListeners.forEach(flag, el => {
        switch (el.event) {
          case "TRUE" :
            allAffected[flag] && el.listener()
            break
          case "FALSE" :
            !allAffected[flag] && el.listener()
            break
          default:
            el.listener()
        }
      })
    })
    valueListeners.forEach(v => {
      switch (v.event) {
        case "AFFECTED_FLAGS" :
          v.listener(allAffected)
          break
        case 'FULL_STATE':
          v.listener(bi.state)
          break
        case 'BIT_VALUE':
          v.listener(value.value)
          break
      }
    })
  }


  value.onValueUpdate(update)

  return bi
}
