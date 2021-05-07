// import { Core } from '../alak/core'
//
// export type AtomSnap = [number, string, string, string[], any, number]
// const orNone = (v) => (v != undefined ? v : '')
// export function atomSnapshot(core: Core): AtomSnap {
//   const { uid, id, _name, metaMap, children, grandChildren } = core
//   const meta = metaMap ? [...metaMap.keys()] : ''
//   let size = children.size
//   if (grandChildren) size += grandChildren.size
//   const value = core.value ? JSON.parse(JSON.stringify(core.value)) : ''
//   return [uid, orNone(id), orNone(_name), orNone(meta), value, size]
// }
