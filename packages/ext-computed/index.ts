/**
 * Расширение вычисления множеств
 * @remarks
 * импорт модуля расширяет интерфейс `Atom`
 * ```typescript
 * declare module 'alak/atom' {
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

import { setAtomValue } from '../atom/core'
import { alive, isPromise } from '../atom/utils'
import { Core, installAtomExtension, IAtom } from '../atom/index'

/** Установить расширение вычисления множеств прокси-атома*/
export function installComputedExtension() {
  installAtomExtension({
    handlers: {
      from,
    },
  })
}

// @ts-ignore
declare module 'alak/core' {
  interface IAtom<T> {
    from<A extends IAtom<any>[]>(...a: A): ComputeStrategy<T, A>
  }
}

type UnpackedPromise<T> = T extends Promise<infer U> ? U : T
type UnpackedFlow<T> = T extends (...args: any[]) => infer U ? U : T
type ReturnArrayTypes<IN extends any[]> = { [K in keyof IN]: UnpackedPromise<UnpackedFlow<IN[K]>> }

type FunComputeIn<T, IN extends any[]> = {
  (...a: ReturnArrayTypes<IN>): T | PromiseLike<T>
}
type ComputedIn<T, IN extends any[]> = {
  (fn: FunComputeIn<T, IN>): T
}

/**
 * Описание стратегий вычисления значения
 */
export interface ComputeStrategy<T, IN extends any[]> {
  /**
   * Функция-обработчик вызывается при наличии значений всех атомов исключая `null` и `undefined`.
   */
  some: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается при отличным от предыдущего отбновлении значений всех атомов, исключая `null` и `undefined`.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  someSafe: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается обновлением любого атома-источника.
   */
  weak: ComputedIn<T, IN>
  /**
   * Функция-обработчик вызывается уникальным обновлением любого атома-источника.
   * Для мутации объектов и массивов посредством fmap, возвращайте Object.assign({}, value}) и [...value]
   */
  weakSafe: ComputedIn<T, IN>
  /**
   * При вызове целевого атома, будет вызвана функци-добытчик у всех асинхронных атомов-источников.
   * Функция-обработчик вызывается при заполнении всех атомов любыми значениями.
   */
  strong: ComputedIn<T, IN>
  /**
   * При вызове целевого атома, будет вызвана функци-добытчик у всех асинхронных атомов-источников.
   * Функция-обработчик вызывается при заполнении всех атомов значениями отличными от предыдущего.
   *
   */
  strongSafe: ComputedIn<T, IN>
}

type ComputeInOut<IN extends any[], OUT> = {
  (...v: ReturnArrayTypes<IN>): OUT
}
type ComputeAtom<IN extends any[]> = {
  <OUT>(fn: ComputeInOut<IN, OUT>): IAtom<OUT>
}

/** @internal */
export type ComputeStrategicAtom<IN extends any[]> = {
  [K in keyof ComputeStrategy<any, IN>]: ComputeAtom<IN>
}

const computedContext = 'computed'

/** @internal */
export function from(...fromAtoms: IAtom<any>[]) {
  const atom: Core = this
  if (atom.haveFrom) {
    throw `from atoms already has a assigned`
  } else {
    atom.haveFrom = true
  }
  let someoneIsWaiting = []
  const addWaiter = () => new Promise((_) => someoneIsWaiting.push(_))
  const freeWaiters = (v) => {
    // console.log("freeWaiters")
    while (someoneIsWaiting.length) {
      someoneIsWaiting.pop()(v)
    }
    atom.isAwaiting && delete atom.isAwaiting
  }

  function applyValue(mixedValue) {
    if (isPromise(mixedValue)) {
      mixedValue.then((v) => {
        freeWaiters(v)
        setAtomValue(atom, v, computedContext)
      })
    } else {
      freeWaiters(mixedValue)
      setAtomValue(atom, mixedValue, computedContext)
    }
    atom.isAwaiting && delete atom.isAwaiting
    return mixedValue
  }

  const makeMix = (mixFn) => {
    const inAwaiting: IAtom<any>[] = []
    const { strong, some } = mixFn
    const needFull = strong || some
    let values = fromAtoms.map((a) => {
      if (a.isAwaiting) {
        inAwaiting.push(a)
      } else if (needFull && !alive(a.value)) {
        inAwaiting.push(a)
      }
      return a.value
    })
    if (inAwaiting.length > 0) {
      atom.getterFn = addWaiter
      return (atom.isAwaiting = addWaiter())
    }
    atom.getterFn = () => mixFn(...values)
    return applyValue(mixFn(...values))
  }
  const linkedValues = {}
  const listen = (a: IAtom<any>, fn: any) => {
    a.next(fn)
    if (!atom.decays) atom.decays = []
    atom.decays.push(() => a.down(fn))
  }
  function weak(mixFn, safe) {
    function mixer(v, a) {
      if (safe) {
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
      if (a !== atom._) {
        linkedValues[a.uid] = a.value
        listen(a, mixer)
      }
    })
    makeMix(mixFn)
    return atom._
  }

  function some(mixFn) {
    mixFn.some = true
    return weak(mixFn, false)
  }

  function someSafe(mixFn) {
    mixFn.some = true
    return weak(mixFn, true)
  }

  function strong(mixFn, safe) {
    // let firstRun = true
    let getting = {}
    let traced = false
    atom._.safe(safe)
    function getterFn(callerUid?) {
      // console.log('getterFn()')
      // if (!isChanged() && !atom.isEmpty)
      //   return atom.value
      // console.log("deep")
      const waiters = {}
      const isWaiting = () => Object.keys(waiters).length
      const values = fromAtoms.map((a) => {
        let v: any = getting[a.uid]
        if (v) return v
        let lv = linkedValues[a.uid]
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
        atom.getterFn = addWaiter
        return (atom.isAwaiting = addWaiter())
      }
      atom.getterFn = getterFn
      getting = {}
      const nv = mixFn(...values)
      if (!traced) {
        traced = true
        // console.log("traced", values)
        atom(nv)
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

      if (!safe || v !== linkedValue) {
        linkedValues[a.uid] = v
        if (safe && !isChanged()) {
          return
        }
        if (traced) {
          // console.log("calling ::: ->")
          const args = getterFn(a.uid)
          if (isPromise(args)) args.then(atom)
          else atom(args)
        }
      }
    }

    fromAtoms.forEach((a) => {
      if (a.uid !== atom._.uid) {
        listen(a, mixer)
      }
    })
    atom.getterFn = () => {
      return getterFn()
    }
    getterFn()
    return atom._
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
