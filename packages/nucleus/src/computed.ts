import { setNucleonValue } from './quark'
import { alive, isPromise } from './utils'

/** @internal */
export function from(...fromNucleons: INucleus<any>[]) {
  const quark: Quark = this
  if (quark.parents) {
    throw `from nucleons already has a assigned`
  } else {
    quark.parents = fromNucleons
  }
  const someoneIsWaiting = []
  const addWaiter = () => new Promise((_) => someoneIsWaiting.push(_))
  const freeWaiters = (v) => {
    // console.log("freeWaiters")
    while (someoneIsWaiting.length) {
      someoneIsWaiting.pop()(v)
    }
    quark.isAwaiting && delete quark.isAwaiting
  }

  function applyValue(mixedValue) {
    if (isPromise(mixedValue)) {
      mixedValue.then((v) => {
        freeWaiters(v)
        setNucleonValue(quark, v)
      })
    } else {
      freeWaiters(mixedValue)
      setNucleonValue(quark, mixedValue)
    }
    quark.isAwaiting && delete quark.isAwaiting
    return mixedValue
  }

  const makeMix = (mixFn) => {
    const inAwaiting: INucleus<any>[] = []
    const { strong, some } = mixFn
    const needFull = strong || some
    const values = fromNucleons.map((a) => {
      if (a.isAwaiting) {
        inAwaiting.push(a)
      } else if (needFull && !alive(a.value)) {
        inAwaiting.push(a)
      }
      return a.value
    })
    if (inAwaiting.length > 0) {
      quark.getterFn = addWaiter
      return (quark.isAwaiting = addWaiter())
    }
    quark.getterFn = () => mixFn(...values)
    return applyValue(mixFn(...values))
  }
  const linkedValues = {}
  const listen = (a: INucleus<any>, fn: any) => {
    a.next(fn)
    if (!quark.decayHooks) quark.decayHooks = []
    quark.decayHooks.push(() => a.down(fn))
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

    fromNucleons.forEach((a) => {
      if (a !== quark._) {
        linkedValues[a.uid] = a.value
        listen(a, mixer)
      }
    })
    makeMix(mixFn)
    return quark._
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
    let rune = false
    quark._.safe(safe)

    function getterFn(callerUid?) {
      // console.log('getterFn()')
      // if (!isChanged() && !quark.isEmpty)
      //   return quark.value
      // console.log("deep")
      const waiters = {}
      const isWaiting = () => Object.keys(waiters).length
      const values = fromNucleons.map((a) => {
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
        quark.getterFn = addWaiter
        return (quark.isAwaiting = addWaiter())
      }
      quark.getterFn = getterFn
      getting = {}
      const nv = mixFn(...values)
      if (!rune) {
        rune = true
        // console.log("rune", values)
        quark(nv)
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
      // console.log("isChanged", yes && fromNucleons.length == keys.length)
      return yes && fromNucleons.length == keys.length
    }

    function mixer(v, a) {
      const linkedValue = linkedValues[a.uid]
      // console.log("mixer")

      if (!safe || v !== linkedValue) {
        linkedValues[a.uid] = v
        if (safe && !isChanged()) {
          return
        }
        if (rune) {
          // console.log("calling ::: ->")
          const args = getterFn(a.uid)
          if (isPromise(args)) args.then(quark)
          else quark(args)
        }
      }
    }

    fromNucleons.forEach((a) => {
      if (a.uid !== quark._.uid) {
        listen(a, mixer)
      }
    })
    quark.getterFn = () => {
      return getterFn()
    }
    getterFn()
    return quark._
  }

  return {
    some: someSafe,
    weak: (f) => weak(f, true),
    strong: (f) => strong(f, true),
  }
}
