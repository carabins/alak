/**
 * System Types for Quark - Internal Implementation
 * Prefixed with _ to denote internal properties
 */
import IQuark from "./IQuark";
import {IQuOptions} from "./index";
import {RealmBus} from './quantum-bus';

// System internal properties and methods
export default interface IQuarkCore<T = any> extends IQuark<T> {
  /** Unique identifier for the quark */
  uid: number
  realm: string
  id: string

  _bus: RealmBus
  /** Internal bit flags for state tracking */
  _flags: number

  /** Realm identifier if realm is set */


  _isAwake: boolean
  // dedup: boolean
  // keepState: boolean
  // isSilent: boolean
  //  emitChanges: boolean
  _emitChangeName: string
  _evName : string
  _pipeFn: (value: T) => T
  _edges: Array<(value: T, quark: IQuark<T>) => void>

}

// export interface InternalQuark<T = any> extends IQuarkCore<T> {
//   (value?: T): T | undefined
// }
