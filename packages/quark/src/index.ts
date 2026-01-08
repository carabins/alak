/**
 * @alaq/quark - High-Performance Reactive Container
 */
import IQuark from "./IQuark";
import setValue from "./setValue";
import quarkProto from "./prototype";
import setupQuarkAndOptions from "./setupQuarkAndOptions";


export interface IQuOptions<T = any> {
  value?: T
  realm?: string
  id?: string
  /** Scope for event bubbling (e.g. 'user.1') */
  scope?: string
  pipe?: (value: T) => T | undefined
  dedup?: boolean
  stateless?: boolean
  emitChanges?: boolean
}

export { CHANGE, AWAKE } from './events'

export function Qu<T>(options?: IQuOptions<T>) {
  function quark(this: any, value: any) {
    return setValue(quark as any, value)
  }

  setupQuarkAndOptions(quark, options)
  Object.setPrototypeOf(quark, quarkProto)
  return quark as IQuark<T>;
}

export function Qv<T>(value?: T, options?: IQuOptions) {
  const q = Qu<T>(options)
  q(value)
  return q
}