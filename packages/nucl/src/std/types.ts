

import type {INucleonCore} from '../INucleon' // TODO: Update to INuclCore or similar




export interface StdArrayMethods<T> {
  
  push(this: INucleusQuark<T[]>, ...items: T[]): INucleusQuark<T[]>

  
  pop(this: INucleusQuark<T[]>): T | undefined

  
  find(this: INucleusQuark<T[]>, fn: (item: T, index: number, array: T[]) => boolean): T | undefined

  
  at(this: INucleusQuark<T[]>, index: number): T | undefined
}




export interface StdObjectMethods<T extends object> {
  
  set<K extends keyof T>(this: INucleusQuark<T>, key: K, val: T[K]): INucleusQuark<T>

  
  get<K extends keyof T>(this: INucleusQuark<T>, key: K): T[K]

  
  pick<K extends keyof T>(this: INucleusQuark<T>, ...keys: K[]): Pick<T, K>
}




export interface StdUniversalMethods {
  
  upSome(this: INucleusQuark<any>, fn: (value: any, nucl: INucleusQuark<any>) => void): () => void

  
  injectTo(this: INucleusQuark<any>, obj: any): INucleusQuark<any>

  
  injectAs(this: INucleusQuark<any>, key: string, obj: any): INucleusQuark<any>
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




export type StdProto =
  & StdArrayMethods<any>
  & StdObjectMethods<any>
  & StdUniversalMethods
  & StdUniversalProperties
  & StdArrayProperties
  & StdObjectProperties