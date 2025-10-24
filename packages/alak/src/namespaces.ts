// import { alakFactory, alakModel, QuarkEventBus } from 'alak/index'
import isBrowser from '@alaq/rune/isBrowser'

export const defaultNamespace = 'default'
const AlakUnionNamespace = 'AlakUnionNamespace'
const AlakUnion = {
  namespaces: {} as Record<string, IUnionCore<any, any, any, any>>,
}

function getBrowserNs() {
  if (globalThis[AlakUnionNamespace]) {
    return (AlakUnion.namespaces = globalThis[AlakUnionNamespace])
  }
  return (globalThis[AlakUnionNamespace] = AlakUnion.namespaces)
}

export const getNamespaces = () =>
  (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces

export interface ActiveUnions {}

export interface QNamespace {
  current: 'default'
}

export type CurrentNamespace = QNamespace['current']

type DefaultUnions = {
  [K in typeof defaultNamespace]: IUnionCore<any, any, any, any>
} & Record<string, IUnionCore<any, any, any, any>>

export type UnionNamespaces = DefaultUnions & ActiveUnions
