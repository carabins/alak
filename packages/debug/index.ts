import { debug } from '../atom/core'
import { Core } from '../atom'
import { DebugEvent } from './events'
import { debugInstance } from './instance'

const receivers = []

export const installAtomDebuggerTool = {
  default(options?: { port: number }) {
    pathCore()
  },
  host() {},
  instance() {
    pathCore()
    const inst = debugInstance()
    receivers.push(inst.receiver)
    return inst.controller
  },
}

function pathCore() {
  debug.enabled = true
  Object.keys(DebugEvent).forEach(
    (eventName) => (debug[eventName] = (...a) => routeEvent(eventName, ...a)),
  )
}
function routeEvent(...args) {
  receivers.forEach((r) => r(...args))
}
