// import { alakFactory, alakModel, QuarkEventBus } from 'alak/index'
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

export const defaultNamespace = 'defaultUnion'
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

type DefaultUnions = {
  defaultUnion: IUnionCore<any, any, any, any>
} & Record<string, IUnionCore<any, any, any, any>>

export type UnionNamespaces = DefaultUnions & ActiveUnions
