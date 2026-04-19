// @alaq/graph-link-state — enum emitter.
//
// Emits a TypeScript `enum` per SDL enum declaration. Values stringify to
// their identifier (easiest on the wire + debuggable logs).

import type { IREnum } from '@alaq/graph'
import { LineBuffer } from './utils'

export function emitEnum(buf: LineBuffer, e: IREnum) {
  buf.line(`// SDL: enum ${e.name} { ${e.values.join(', ')} }`)
  buf.line(`export enum ${e.name} {`)
  buf.indent()
  for (const v of e.values) {
    buf.line(`${v} = '${v}',`)
  }
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitEnums(buf: LineBuffer, enums: Record<string, IREnum>) {
  const names = Object.keys(enums).sort()
  for (const name of names) {
    emitEnum(buf, enums[name])
  }
}
