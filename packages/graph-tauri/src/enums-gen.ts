// @alaq/graph-tauri — enum emitter.
//
// Mirrors the shape of @alaq/graph-link-state: one TS `enum` per SDL enum
// whose values stringify to their identifiers. This matches how Tauri v2
// serializes Rust enums with the default `#[derive(Serialize, Deserialize)]`
// (stringly-typed tag) — round-trip works without a bespoke wire codec.

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
