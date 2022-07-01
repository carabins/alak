// @ts-nocheck
/**
 * Расширение вычисления множеств
 * @remarks
 * импорт модуля расширяет интерфейс `Atom`
 * ```typescript
 * declare module 'alak/core' {
 *   interface IAtom<T> {
 *     from<A extends IAtom<any>[]>(...a: A): ComputeStrategy<T, A>
 *   }
 * }
 * ```
 * Алгоритм использования:
 *
 * - аргументами функции задаются атомы-источники вычисления
 *
 * - выбирается стратегия вычисления
 *
 * - задаётся функция-вычислитель, принимающая значения атомов-источников
 *
 * - вычисленное значение функции-вычислителя устанавливается в атом контекста
 * @example
 * ```javascript
 * const a1 = A(1)
 * const a2 = A(2)
 * const computedAtom = A()
 * computedAtom.from(a1, a2).some((v1, v2) => v1 + v2)
 * console.log(computedAtom()) //output:3
 * ```
 * @public
 * @packageDocumentation
 */
import { setAtomValue } from './core'
import { alive, isPromise } from './utils'

const computedContext = 'computed'

/** @internal */
export function from(...fromAtoms: IAtom<any>[]) {
  const core: Core = this
  if (core.parents) {
    throw `from atoms already has a assigned`
  } else {
    core.parents = fromAtoms
  }
  const someoneIsWaiting = []
  const addWaiter = () => new Promise((_) => someoneIsWaiting.push(_))
  const freeWaiters = (v) => {
    // console.log("freeWaiters")
    while (someoneIsWaiting.length) {
      someoneIsWaiting.pop()(v)
    }
    core.isAwaiting && delete core.isAwaiting
  }

  function applyValue(mixedValue) {
    if (isPromise(mixedValue)) {
      mixedValue.then((v) => {
        freeWaiters(v)
        setAtomValue(core, v, computedContext)
      })
    } else {
      freeWaiters(mixedValue)
      setAtomValue(core, mixedValue, computedContext)
    }
    core.isAwaiting && delete core.isAwaiting
    return mixedValue
  }

  const makeMix = (mixFn) => {
    const inAwaiting: IAtom<any>[] = []
    const { strong, some } = mixFn
    const needFull = strong || some
    const values = fromAtoms.map((a) => {
      if (a.isAwaiting) {
        inAwaiting.push(a)
      } else if (needFull && !alive(a.value)) {
        inAwaiting.push(a)
      }
      return a.value
    })
    if (inAwaiting.length > 0) {
      core.getterFn = addWaiter
      return (core.isAwaiting = addWaiter())
    }
    core.getterFn = () => mixFn(...values)
    return applyValue(mixFn(...values))
  }
  const linkedValues = {}
  const listen = (a: IAtom<any>, fn: any) => {
    a.next(fn)
    if (!core.decays) core.decays = []
    core.decays.push(() => a.down(fn))
  }
  function weak(mixFn, finiteLoop) {
    function mixer(v, a) {
      if (finiteLoop) {
        const linkedValue = linkedValues[a.uid]
        if (v !== linkedValue) {
          makeMix(mixFn)
          linkedValues[a.uid] = v
        }
      } else {
        makeMix(mixFn)
      }
    }

    fromAtoms.forEach((a) => {
      if (a !== core._) {
        linkedValues[a.uid] = a.value
        listen(a, mixer)
      }
    })
    makeMix(mixFn)
    return core._
  }

  function some(mixFn) {
    mixFn.some = true
    return weak(mixFn, false)
  }

  function someSafe(mixFn) {
    mixFn.some = true
    return weak(mixFn, true)
  }

  function strong(mixFn, finiteLoop) {
    // let firstRun = true
    let getting = {}
    let traced = false
    core._.setFiniteLoop(finiteLoop)
    function getterFn(callerUid?) {
      // console.log('getterFn()')
      // if (!isChanged() && !core.isEmpty)
      //   return core.value
      // console.log("deep")
      const waiters = {}
      const isWaiting = () => Object.keys(waiters).length
      const values = fromAtoms.map((a) => {
        let v: any = getting[a.uid]
        if (v) return v
        const lv = linkedValues[a.uid]
        if (callerUid && callerUid == a.uid) {
          v = lv ? lv : a()
        } else {
          v = a.isStateless ? a() : lv ? lv : a()
        }
        if (isPromise(v)) {
          waiters[a.uid] = true
          // console.log(a.id, 'is promise', isWaiting())
          v.then((v) => {
            getting[a.uid] = v
            linkedValues[a.uid] = v
            delete waiters[a.uid]
            // console.log(a.id, 'resolve', isWaiting())
            if (!isWaiting()) {
              const deepValue = getterFn()
              if (!isPromise(deepValue)) {
                freeWaiters(deepValue)
              }
            }
          })
        }
        {
          linkedValues[a.uid] = v
        }
        return v
      })

      if (isWaiting()) {
        core.getterFn = addWaiter
        return (core.isAwaiting = addWaiter())
      }
      core.getterFn = getterFn
      getting = {}
      const nv = mixFn(...values)
      if (!traced) {
        traced = true
        // console.log("traced", values)
        core(nv)
      }
      return nv
    }

    const lastLinks = {}

    function isChanged() {
      let yes = false
      const keys = Object.keys(linkedValues)
      keys.forEach((k) => {
        // console.log("->", linkedValues[k] , lastLinks[k])
        if (linkedValues[k] !== lastLinks[k]) {
          yes = true
        }
        lastLinks[k] = linkedValues[k]
      })
      // console.log("isChanged", yes && fromAtoms.length == keys.length)
      return yes && fromAtoms.length == keys.length
    }

    function mixer(v, a) {
      const linkedValue = linkedValues[a.uid]
      // console.log("mixer")

      if (!finiteLoop || v !== linkedValue) {
        linkedValues[a.uid] = v
        if (finiteLoop && !isChanged()) {
          return
        }
        if (traced) {
          // console.log("calling ::: ->")
          const args = getterFn(a.uid)
          if (isPromise(args)) args.then(core)
          else core(args)
        }
      }
    }

    fromAtoms.forEach((a) => {
      if (a.uid !== core._.uid) {
        listen(a, mixer)
      }
    })
    core.getterFn = () => {
      return getterFn()
    }
    getterFn()
    return core._
  }

  return {
    some,
    someSafe,
    weak,
    weakSafe: (f) => weak(f, true),
    strong,
    strongSafe: (f) => strong(f, true),
  }
}
