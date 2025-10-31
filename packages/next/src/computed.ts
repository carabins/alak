import { setNucleonValue } from '@alaq/nucleus/quark'
import { alive, isPromise } from '@alaq/nucleus/utils'

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
    const needFull = strong // только strong требует все значения, some - нет
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

  function weak(mixFn) {
    function mixer(v, a) {
      const linkedValue = linkedValues[a.uid]
      if (v !== linkedValue) {
        makeMix(mixFn)
        linkedValues[a.uid] = v
      }
    }

    fromNucleons.forEach((a) => {
      if (a !== quark._) {
        linkedValues[a.uid] = a.value
        listen(a, mixer)
      }
    })

    // Для .some() вычисляем только если есть хотя бы одно значение
    if (mixFn.some) {
      const hasAnyValue = fromNucleons.some((a) => alive(a.value))
      if (hasAnyValue) {
        makeMix(mixFn)
      }
    } else {
      makeMix(mixFn)
    }

    return quark._
  }

  function some(mixFn) {
    mixFn.some = true
    return weak(mixFn)
  }


  function strong(mixFn) {
    // let firstRun = true
    let getting = {}
    let rune = false
    quark._.finite(true)

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
        } else if (!alive(v) && !a.isStateless) {
          // Для .strong() если значение не alive и не stateless - ждем
          // НО не ждем, если это текущий caller (он только что установил значение)
          if (!callerUid || callerUid !== a.uid) {
            waiters[a.uid] = true
          }
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

      if (v !== linkedValue) {
        linkedValues[a.uid] = v
        if (!isChanged()) {
          return
        }
        // Вычисляем когда значение изменилось
        // console.log("calling ::: ->")
        const args = getterFn(a.uid)
        // getterFn возвращает Promise если ждет значений - не вызываем quark
        // Вызываем только если получили реальное значение
        if (!isPromise(args) && args !== undefined) {
          quark(args)
        }
      }
    }

    fromNucleons.forEach((a) => {
      if (a.uid !== quark._.uid) {
        linkedValues[a.uid] = a.value
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
    some,
    weak: (f) => weak(f),
    strong: (f) => strong(f),
  }
}
