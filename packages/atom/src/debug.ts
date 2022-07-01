import { handlers, proxyProps } from './handlers'
import { DECAY_ATOM_ERROR, PROPERTY_ATOM_ERROR, rnd } from './utils'

const atomBase = {}
export const isBrowser = new Function('try {return this===window;}catch(e){ return false;}')

export const debug = {
  enabled: false,

  updateAsyncStart(core: Core, context?: string) {
    // if (core.isPrivate) return
    // this.log(core, 'updateAsyncFinish', { context, value: core.value })
  },
  updateAsyncFinish(core: Core) {
    // if (core.isPrivate) return
    // this.log(core, 'updateAsyncFinish')
  },
  updateValue(core: Core, context: string) {
    // if (core.isPrivate) return
    // this.log(core, 'updateValue', { context, value: core.value })
  },
  log(core: Core, type, info?) {
    // if (core.isPrivate) return
  },
  activate(url?) {
    // this.enabled = true
    // const front = isBrowser()
    // let cl
    // let queue = []
    // let sid = rnd()
    // let startTime = Date.now()
    // const method = 'POST'
    // const send = (data) => {
    //   let body = JSON.stringify(data)
    //   if (front) {
    //     fetch(url, {
    //       method,
    //       body,
    //     })
    //   } else {
    //     let u = url.split(':')
    //     let req = require('http').request({
    //       host: u[0],
    //       port: u[1],
    //       method,
    //     })
    //     req.write(body)
    //     req.end()
    //   }
    //   queue = []
    //   cl = null
    // }
    // send({
    //   sid,
    //   app: {
    //     startTime,
    //     front,
    //     ua: front
    //       ? window.navigator.userAgent
    //       : {
    //           argv: process.argv,
    //           version: process.version,
    //         },
    //   },
    // })
    // const push = () => {
    //   send({
    //     sid,
    //     queue,
    //   })
    // }
    // this.log = (core: Core, type, data) => {
    //   if (core.isPrivate) return
    //   let t = Date.now()
    //   let a = JSON.stringify({
    //     uid: core.uid,
    //     id: core.id,
    //     _name: core._name,
    //     isAsync: core.isAsync,
    //     isSafe: core.isSafe,
    //     isStateless: core.isStateless,
    //     isEmpty: core.isEmpty,
    //     children: core.children ? aids(core.children) : null,
    //     isHoly: core.isHoly,
    //     meta: core.meta,
    //   })
    //   if (atomBase[core.uid] != a) {
    //     atomBase[core.uid] = a
    //     queue.push([t, core.uid, 'src', a])
    //   }
    //   queue.push([t, core.uid, type, data])
    //   if (!cl) {
    //     cl = setTimeout(push, 987)
    //   }
    // }
  },
}
export default debug

// export const proxyDebugHandler = {
//   apply(core: Core, thisArg: any, argArray?: any): any {
//     if (!core || !core.children) {
//       throw DECAY_ATOM_ERROR
//     }
//     return core(...argArray)
//   },
//   get(core: Core, key: PropertyKey, receiver: any): any {
//     if (!core.children) {
//       throw DECAY_ATOM_ERROR
//     }
//     let f = core[key]
//     if (typeof f === 'function') {
//       return (...v) => {
//         let isFn = typeof v[0] === 'function'
//         if (isFn) {
//           debug.log(core, key, { ...detectFnContext(v[0]), value: v[1] })
//         } else debug.log(core, key, v)
//         return core[key](...v)
//       }
//     }
//     return f
//   },
// }
//
// const aids = (m) => {
//   let r = []
//   m.forEach((i) => {
//     r.push(detectFnContext(i))
//   })
//   return r
// }
//
// function detectFnContext(fn) {
//   let isAtom = !!fn.isAtom
//   let id = fn.id || fn.uid || fn.name || fn.toString()
//   return { isAtom, uid: fn.uid, id }
// }
