/**
 * Quark Prototype - методы кварка
 */

import { HAS_GROW_UP, EMIT_CHANGES, HAS_REALM, DEDUP, STATELESS, IS_EMPTY, SILENT } from './flags'
import { quantumBus } from './quantum-bus'
import IQuarkCore from "./IQuarkCore";

type AnyFunction = (...args: any[]) => any
type Listener<T> = (value: T, quark: any) => void

/** Базовый прототип кварка */
export const quarkProto = {
  up(this: any, listener: Listener<any>) {
    // Lazy init listeners - используем массив вместо Set (быстрее для <10 listeners)
    if (!this._listeners) {
      this._listeners = []
      this._flags |= HAS_GROW_UP
    }

    this._listeners.push(listener)

    // Немедленно вызываем если значение было установлено
    // Проверяем инвертированный флаг IS_EMPTY (быстрее чем this.value !== undefined)
    if (!(this._flags & IS_EMPTY)) {
      listener(this.value, this)
    }
    return this
  },

  down(this: any, listener: Listener<any>) {
    if (this._listeners) {
      const index = this._listeners.indexOf(listener)
      if (index !== -1) {
        this._listeners.splice(index, 1)
        if (this._listeners.length === 0) {
          this._flags &= ~HAS_GROW_UP
        }
      }
    }
    return this
  },

  silent(this: any, value: any) {
    this._flags |= SILENT
    // Вызываем quark как функцию напрямую
    Reflect.apply(this, null, [value])
    this._flags &= ~SILENT
    return this
  },

  pipe(this: any, fn: (value: any) => any) {
    this._pipeFn = fn
    return this
  },

  dedup(this: any, enable: boolean = true) {
    if (enable) {
      this._flags |= DEDUP
    } else {
      this._flags &= ~DEDUP
    }
    return this
  },

  stateless(this: any, enable: boolean = true) {
    if (enable) {
      this._flags |= STATELESS
    } else {
      this._flags &= ~STATELESS
    }
    return this
  },

  decay(this: any) {
    // Очистка listeners (массив)
    this._listeners = null
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
