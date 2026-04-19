// @alaq/graph-link-state — optional Vue 3 composables emitter.
//
// When `generate({ vue: true })` is requested, for every record we emit:
//
//   • `Use<Record>Result` — the shape of what the composable returns.
//   • `use<Record>(store, id|path)` — low-level composable taking an explicit
//     SyncStore.
//   • `use<Record>InScope(id|path)` — high-level composable that resolves the
//     SyncStore from Vue's provide/inject via `useStore()`.
//
// The result intentionally keeps just three reactive surfaces:
//   - `node`   — the typed node facade (non-reactive, use node.$field + useNode
//                for field-level reactivity)
//   - `value`  — `Ref<I<Record> | undefined>` bound to the node's root value
//   - `status` — `Ref<SyncStatus>` bound to the $status quark
//
// Field-level Refs (one Ref per SDL field) and action-only composables are a
// deliberate v0.4 concern — see the package README for the decision record.
//
// This file produces no imports or output when `vue: false` (the default). It
// never references `vue` or `@alaq/link-state-vue` at generator runtime — only
// as strings in the generated source.

import type { IRRecord } from '@alaq/graph'
import { LineBuffer } from './utils'
import { getRecordScope } from './nodes-gen'

export interface VueEmitOptions {
  /** Import specifier for the Vue adapter. Default: '@alaq/link-state-vue'. */
  vueImport: string
  /** Import specifier for the runtime (reused for SyncStatus type). */
  runtimeImport: string
}

/**
 * Emit the Vue-specific import block. Caller is responsible for only calling
 * this when `vue: true` — the block is never a no-op.
 */
export function emitVueImports(buf: LineBuffer, opts: VueEmitOptions) {
  buf.line(`import type { Ref } from 'vue'`)
  buf.line(`import { useNode, useStore } from '${opts.vueImport}'`)
  buf.blank()
}

function useFnName(rec: IRRecord): string {
  return `use${rec.name}`
}

function useInScopeFnName(rec: IRRecord): string {
  return `use${rec.name}InScope`
}

function resultTypeName(rec: IRRecord): string {
  return `Use${rec.name}Result`
}

function emitResultInterface(buf: LineBuffer, rec: IRRecord) {
  buf.line(`export interface ${resultTypeName(rec)} {`)
  buf.indent()
  buf.line(`node: ${rec.name}Node`)
  buf.line(`value: Ref<I${rec.name} | undefined>`)
  buf.line(`status: Ref<'pending' | 'ready' | 'error' | undefined>`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

function emitUseFn(buf: LineBuffer, rec: IRRecord) {
  const scope = getRecordScope(rec)
  const argName = scope ? 'id' : 'path'
  const statusT = `'pending' | 'ready' | 'error'`
  buf.line(
    `export function ${useFnName(rec)}(store: SyncStore, ${argName}: string): ${resultTypeName(rec)} {`,
  )
  buf.indent()
  buf.line(`const node = create${rec.name}Node(store, ${argName})`)
  buf.line(`return {`)
  buf.indent()
  buf.line(`node,`)
  buf.line(`value: useNode(node.$node),`)
  // $status is an IQ<…>, not an ISyncNode<…>. Structurally it exposes the same
  // .value / .up() surface that useNode consumes, but the static type differs.
  // Cast through `unknown` so callers don't have to; the runtime is safe.
  buf.line(
    `status: useNode(node.$status as unknown as ISyncNode<${statusT}>),`,
  )
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

function emitUseInScopeFn(buf: LineBuffer, rec: IRRecord) {
  const scope = getRecordScope(rec)
  const argName = scope ? 'id' : 'path'
  buf.line(
    `export function ${useInScopeFnName(rec)}(${argName}: string): ${resultTypeName(rec)} {`,
  )
  buf.indent()
  buf.line(`return ${useFnName(rec)}(useStore(), ${argName})`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitVueComposables(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    const rec = records[name]
    emitResultInterface(buf, rec)
    emitUseFn(buf, rec)
    emitUseInScopeFn(buf, rec)
  }
}
