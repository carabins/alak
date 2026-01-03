/**
 * Quark Prototype - методы кварка
 */

import {IS_AWAKE, EMIT_CHANGES, HAS_REALM, DEDUP, STATELESS, IS_EMPTY, SILENT} from './flags'
import {quantumBus} from './quantum-bus'
import IQuarkCore from "./IQuarkCore";

type AnyFunction = (...args: any[]) => any
type Listener<T> = (value: T, quark: any) => void

/** Базовый прототип кварка */
export const quarkProto = {
  up(this: IQuarkCore, listener: Listener<any>) {
    // Lazy init listeners - используем массив вместо Set (быстрее для <10 listeners)
    if (!this._isAwake) {
      this._edges = []
      this._isAwake = true
      this._flags |= IS_AWAKE
    }


    this._edges.push(listener)

    if (!(this._flags & IS_EMPTY)) {
      listener(this.value, this)
    }
    return this
  },

  down(this: IQuarkCore, listener: Listener<any>) {
    if (this._isAwake) {
      const index = this._edges.indexOf(listener)
      if (index !== -1) {
        this._edges.splice(index, 1)
        if (this._edges.length === 0) {
          this._flags &= ~IS_AWAKE
          this._isAwake = false
        }
      }
    }
    return this
  },

  silent(this: IQuarkCore, value: any) {
    this._flags |= SILENT
    // Вызываем quark как функцию напрямую
    Reflect.apply(this, null, [value])
    this._flags &= ~SILENT
    return this
  },

  pipe(this: IQuarkCore, fn: (value: any) => any) {
    this._pipeFn = fn
    return this
  },

  dedup(this: IQuarkCore, enable: boolean = true) {
    if (enable) {
      this._flags |= DEDUP
    } else {
      this._flags &= ~DEDUP
    }
    return this
  },

  stateless(this: IQuarkCore, enable: boolean = true) {
    if (enable) {
      this._flags |= STATELESS
    } else {
      this._flags &= ~STATELESS
    }
    return this
  },

  decay(this: IQuarkCore) {
    // Очистка listeners (массив)
    this._edges = null
    delete this.value
    this._flags = 0
  },
}

// Геттеры
// Object.defineProperties(quarkProto, {
//   bus: {
//     get(this: IQuarkCore) {
//       if (!this._bus) {
//         this._bus = quantumBus.getRealm(this.realm)
//       }
//       return !!(this._flags & HAS_GROW_UP)
//     },
//     enumerable: true,
//   },
// })

export default quarkProto
