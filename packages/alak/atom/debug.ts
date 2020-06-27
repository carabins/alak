import { AlakProxyMode } from './index'
import { proxyProps } from './handlers'
import { isBrowser } from './utils'

let atomBase = {}

export const debug = {
  enabled: false,

  updateAsyncStart(core: Core, context?: string) {
    this.log(core, 'updateAsyncFinish', { context, value: core.value })
  },
  updateAsyncFinish(core: Core) {
    this.log(core, 'updateAsyncFinish')
  },
  updateValue(core: Core, context: string) {
    this.log(core, 'updateValue', { context, value: core.value })
  },
  log(core: Core, type, info?) {},
  activate(url?) {
    AlakProxyMode()
    this.enabled = true
    const front = isBrowser()
    let cl = 0
    let queue = []
    const method = 'POST'
    const push = () => {
      let body = JSON.stringify(queue)
      if (front) {
        fetch(url, {
          method,
          body,
        })
      } else {
        let u = url.split(':')
        let req = require('http').request({
          host: u[0],
          port: u[1],
          method,
        })
        req.write(body)
        req.end()
      }
      queue = []
    }
    this.log = (core: Core, type, data) => {
      let t = Date.now()
      let a = JSON.stringify({
        uid: core.uid,
        id: core.id,
        _name: core._name,
        isAsync: core.isAsync,
        isSafe: core.isSafe,
        isStateless: core.isStateless,
        isEmpty: core.isEmpty,
        children: core.children ? aids(core.children) : null,
        isHoly: core.isHoly,
        meta: core.meta,
      })
      if (atomBase[core.uid] != a) {
        atomBase[core.uid] = a
        queue.push([t, core.uid, 'atom', a])
      }
      queue.push([t, core.uid, type, data])
      if (!cl) setTimeout(push, 987)
    }
  },
}
export default debug
export const proxyDebugHandler = {
  get(core: Core, key: PropertyKey, receiver: any): any {
    if (proxyProps[key]) return core[key]
    return (...v) => {
      if (typeof v[0] === 'function') {
        debug.log(core, key, { ...detectFnContext(v[0]), value: v[1] })
      } else debug.log(core, key, v)
      core[key](...v)
    }
  },
}

const aids = (m) => {
  let r = []
  m.forEach((i) => {
    r.push(detectFnContext(i))
  })
  return r
}

function detectFnContext(fn) {
  let isAtom = !!fn.isAtom
  let id = fn.id || fn.uid || fn.name || fn.toString()
  return { isAtom, id }
}
