// import { alakFactory, alakModel, QuarkEventBus } from 'alak/index'
import isBrowser from '@alaq/rune/isBrowser'


export const defaultNamespace = 'defaultUnion'
const AlakUnionNamespace = 'AlakUnionNamespace'
const AlakUnion = {
  namespaces: {},
}

function getBrowserNs() {
  if (globalThis[AlakUnionNamespace]) {
    return (AlakUnion.namespaces = globalThis[AlakUnionNamespace])
  }
  return (globalThis[AlakUnionNamespace] = AlakUnion.namespaces)
}


export const getNamespaces = () => (isBrowser ? getBrowserNs() : AlakUnion.namespaces) as UnionNamespaces


export interface ActiveUnions {
  defaultUnion: IUnionDevCore
}

type DefaultUnions = {
  defaultUnion: IUnionDevCore
}

export type UnionNamespaces = DefaultUnions & ActiveUnions
