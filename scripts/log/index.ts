// @ts-nocheck
// @ts-expect-error

import pino from 'pino'
import * as path from 'path'
import * as color from 'colorette'
import pretty from 'pino-pretty'

const starTime = Date.now()
const logInstance = pino(
  pretty({
    ignore: 'time,pid,hostname,module',
    hideObject: true,
    // translateTime:true,
    customPrettifiers: {
      time: (timestamp) => -1 * (starTime - timestamp), //((starTime - timestamp) - 10000000000),
    },
    messageFormat: (log) => {
      let s = ''
      if (log.module) {
        s = `${color.dim(log.module)} `
      }
      if (log.msg) {
        s += log.msg
      }
      return s
    },
  }),
)

type Levels = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
type LogCall = {
  (...info: any[]): void
}
type LevelCalls = {
  [K in Levels]: LogCall
}
type ProxyLoger = LevelCalls & LogCall

const parseMultiline = (ll) => {
  if (ll.length > 1) {
    let a = ll.map((l) => {
      switch (typeof l) {
        case 'function':
          return 'Func:' + `(${l.name || 'anonymous'})`
        case 'object':
          return JSON.stringify(l)
        default:
          return l
      }
    })
    return a.join(' ')
  } else {
    return ll[0]
  }
}

const newProxy = (i) =>
  new Proxy(i as Function, {
    apply(target: any, thisArg: any, argArray: any[]): any {
      target.l.info(parseMultiline(argArray))
    },
    get(target: any, p: string | symbol): any {
      return (...l) => target.l[p](parseMultiline(l))
    },
  }) as ProxyLoger

function wrapLog(module) {
  function fn() {}
  fn.l = logInstance.child({ module }, { level: 10 })
  return newProxy(fn)
}
export const Log = wrapLog(false)

export function createModuleLogger(module) {
  return wrapLog(module)
}
