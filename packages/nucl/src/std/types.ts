

import type {INucleonCore} from '../INucleon' // TODO: Update to INuclCore or similar




export interface StdArrayMethods<T> {
  
  push(this: INucleonCore, ...items: T[]): INucleonCore

  
  pop(this: INucleonCore): T | undefined

  
  find(this: INucleonCore, fn: (item: T, index: number, array: T[]) => boolean): T | undefined

  
  at(this: INucleonCore, index: number): T | undefined
}




export interface StdObjectMethods<T extends object> {
  
  set<K extends keyof T>(this: INucleonCore, key: K, val: T[K]): INucleonCore

  
  get<K extends keyof T>(this: INucleonCore, key: K): T[K]

  
  pick<K extends keyof T>(this: INucleonCore, ...keys: K[]): Pick<T, K>
}




export interface StdUniversalMethods {
  
  upSome(this: INucleonCore, fn: (value: any, nucl: INucleonCore) => void): () => void

  
  injectTo(this: INucleonCore, obj: any): INucleonCore

  
  injectAs(this: INucleonCore, key: string, obj: any): INucleonCore
}




export interface StdUniversalProperties {
  
  isEmpty: boolean
}




export interface StdArrayProperties {
  
  size: number | undefined
}




export interface StdObjectProperties {
  
  keys: string[]

  
  values: any[]
}




export type NucleusProto =
  & StdArrayMethods<any>
  & StdObjectMethods<any>
  & StdUniversalMethods
  & StdUniversalProperties
  & StdArrayProperties
  & StdObjectProperties