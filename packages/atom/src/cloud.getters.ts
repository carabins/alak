import N from '@alaq/nucleus/index'

import CloudElectrons from './cloud.electrons'
function awakeNucleon(n, getNucleon, thisContext, computeFn, finalListener) {
  const upDateOn = {}
  const proxyContext = new Proxy(thisContext, {
    get(target: {}, p: string | symbol, receiver: any): any {
      getNucleon(p)
      if (typeof p === 'string') {
        upDateOn[p] = true
      }
      return target[p]
    },
  })

  n(computeFn.apply(proxyContext))

  Object.keys(upDateOn).forEach((nucleonKey) => {
    const subNucleon = getNucleon(nucleonKey)
    subNucleon.next(finalListener)
  })
}

export default function (electrons: CloudElectrons, domain) {
  const sleepingNucleons = {}
  Object.keys(electrons.getters).forEach((key) => {
    const n = N.id(domain + '.' + key)
    const computeFn = electrons.getters[key] as Function
    const finalListener = () => {
      const result = computeFn.apply(electrons.state)
      n(result)
    }
    n.addMeta('sleep', () =>
      awakeNucleon(n, electrons.getNucleon, electrons.state, computeFn, finalListener),
    )
    sleepingNucleons[key] = n
  })
  return sleepingNucleons
}
