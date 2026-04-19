// @alaq/graph-link-state — SyncNode wrapper emitter.
//
// For every record, emit:
//   1. An interface `<Record>Node` describing the typed facade.
//   2. A factory `create<Record>Node(store, ...)` building that facade from
//      the runtime `SyncStore`.
//
// The facade exposes three distinct surfaces per field:
//   • `$<field>`   — a reactive `ISyncNode<T>` (drill-down, subscribe, write)
//   • `<field>`    — a direct snapshot value (fast read, non-reactive)
//   • nested record fields are typed as the nested record's Node, wired via
//     the runtime's `_node(key)` helper which dispatches through `store.get`.
//
// Scoped records (`@scope(name: "...")`) take an `id` argument; the path is
// `{scope}.{id}`. Scoped actions whose `scope` matches are bound as methods
// on the facade (delegated in actions-gen.ts; the interface shape lives
// here to keep one node-decl-per-record).

import type { IRAction, IRRecord } from '@alaq/graph'
import {
  LineBuffer,
  TypeContext,
  camelCase,
  findDirective,
  isListField,
  isMapField,
  itemFactoryExpr,
  itemNodeType,
  listItemRef,
  mapFieldType,
  mapFieldTypeOptional,
  mapTypeRef,
  renderDirectiveComment,
  valueNodeType,
} from './utils'

export interface RecordKind {
  scope: string | null
}

export function getRecordScope(rec: IRRecord): string | null {
  if (rec.scope) return rec.scope
  const scopeDir = findDirective(rec.directives, 'scope')
  if (scopeDir && typeof scopeDir.args?.name === 'string') {
    return scopeDir.args.name as string
  }
  return null
}

/**
 * Return actions that should be bound as methods on `<Record>Node` — i.e.
 * the record's scope matches the action's scope.
 */
export function scopedActionsFor(
  rec: IRRecord,
  actions: Record<string, IRAction>,
): IRAction[] {
  const scope = getRecordScope(rec)
  if (!scope) return []
  return Object.values(actions).filter(a => a.scope === scope)
}

function renderActionInputType(action: IRAction, ctx: TypeContext): string {
  const inputs = action.input ?? []
  if (inputs.length === 0) return ''
  const fields = inputs.map(f => {
    const ts = mapFieldType(f, ctx)
    const optional = f.required ? '' : '?'
    return `${f.name}${optional}: ${ts}`
  })
  return `{ ${fields.join(', ')} }`
}

function renderActionOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return 'void'
  const fakeField = {
    name: '_',
    type: action.output,
    required: action.outputRequired === true,
    list: false,
  } as any
  return mapFieldTypeOptional(fakeField, ctx)
}

/**
 * Runtime-provided keys that cannot also appear as SDL field names on the
 * generated facade. If an SDL field collides (e.g. a record with `status:
 * RoomStatus!`), the reactive accessor gets a `Field` suffix and a comment
 * flags the rename. Snapshot accessor is kept unsuffixed when it doesn't
 * collide.
 */
const RESERVED_REACTIVE = new Set([
  '$node', '$status', '$meta', '$error', '$release', 'value',
])
const RESERVED_SNAPSHOT = new Set(['$node', '$status', '$meta', '$error', '$release', 'value'])

function reactiveKey(fieldName: string): { key: string; renamed: boolean } {
  const raw = `$${fieldName}`
  if (RESERVED_REACTIVE.has(raw)) return { key: `${raw}Field`, renamed: true }
  return { key: raw, renamed: false }
}

function snapshotKey(fieldName: string): { key: string; renamed: boolean } {
  if (RESERVED_SNAPSHOT.has(fieldName)) return { key: `${fieldName}Value`, renamed: true }
  return { key: fieldName, renamed: false }
}

function emitNodeInterface(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
  boundActions: IRAction[],
) {
  buf.line(`export interface ${rec.name}Node {`)
  buf.indent()
  buf.line(`readonly $node: ISyncNode<I${rec.name}>`)
  buf.line(`readonly value: I${rec.name} | undefined`)
  buf.line(`readonly $status: IQ<'pending' | 'ready' | 'error'>`)
  buf.line(`readonly $meta: { readonly isGhost: boolean; readonly path: string }`)
  buf.line(`$release(): void`)
  buf.blank()

  // Reactive sub-nodes.
  buf.line(`// Reactive field nodes`)
  for (const f of rec.fields) {
    const { key, renamed } = reactiveKey(f.name)
    if (renamed) buf.line(`// (renamed from $${f.name} — collides with runtime facade)`)

    if (isListField(f)) {
      // v0.4: list fields expose per-index reactive accessors. `N` is the
      // element's node type (scalar → `ISyncNode<T>`; record → `<Rec>Node`;
      // nested list/map → another Sync*Node).
      const elemRef = listItemRef(f)
      const elemTs = f.listItemRequired === false
        ? `(${mapTypeRef({ ...elemRef, required: true }, ctx)} | undefined)`
        : mapTypeRef(elemRef, ctx)
      const nType = itemNodeType(elemRef, ctx)
      buf.line(`readonly ${key}: SyncListNode<${elemTs}, ${nType}>`)
    } else if (isMapField(f)) {
      // v0.4: map fields expose per-key reactive accessors. Nested maps
      // compose naturally: Map<K, Map<K2, V>> → SyncMapNode<K, Record<K2, V>,
      // SyncMapNode<K2, V, ISyncNode<V>>>.
      const k = mapTypeRef(f.mapKey!, ctx)
      const v = mapTypeRef(f.mapValue!, ctx)
      const nType = valueNodeType(f.mapValue!, ctx)
      buf.line(`readonly ${key}: SyncMapNode<${k}, ${v}, ${nType}>`)
    } else if (ctx.records[f.type]) {
      buf.line(`readonly ${key}: ${f.type}Node`)
    } else {
      const ts = mapFieldTypeOptional(f, ctx)
      buf.line(`readonly ${key}: ISyncNode<${ts}>`)
    }
  }
  buf.blank()

  // Snapshot accessors (non-reactive).
  buf.line(`// Direct value accessors (snapshot, not reactive)`)
  for (const f of rec.fields) {
    const ts = mapFieldTypeOptional(f, ctx)
    const { key, renamed } = snapshotKey(f.name)
    if (renamed) buf.line(`// (renamed from ${f.name} — collides with runtime facade)`)
    buf.line(`readonly ${key}: ${ts}`)
  }

  // Bound actions.
  if (boundActions.length > 0) {
    buf.blank()
    buf.line(`// Scope-bound actions (${getRecordScope(rec)})`)
    for (const a of boundActions) {
      const inputTs = renderActionInputType(a, ctx)
      const outTs = renderActionOutputType(a, ctx)
      const arg = inputTs ? `input: ${inputTs}` : ''
      buf.line(`${camelCase(a.name)}(${arg}): Promise<${outTs}>`)
    }
  }

  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

function emitNodeFactory(
  buf: LineBuffer,
  rec: IRRecord,
  ctx: TypeContext,
  boundActions: IRAction[],
) {
  const scope = getRecordScope(rec)
  const recordDirs = (rec.directives ?? []).map(renderDirectiveComment)
  if (recordDirs.length) {
    buf.line(`// ${recordDirs.join(' ')}`)
  }

  if (scope) {
    buf.line(
      `export function create${rec.name}Node(store: SyncStore, id: string): ${rec.name}Node {`,
    )
    buf.indent()
    buf.line(`const path = \`${scope}.\${id}\``)
  } else {
    buf.line(
      `export function create${rec.name}Node(store: SyncStore, path: string): ${rec.name}Node {`,
    )
    buf.indent()
  }
  buf.line(`const base = store.get(path) as ISyncNode<I${rec.name}>`)
  buf.line(`return {`)
  buf.indent()
  buf.line(`$node: base,`)
  buf.line(`get value() { return base.value as I${rec.name} | undefined },`)
  buf.line(`get $status() { return base.$status },`)
  buf.line(`get $meta() { return base.$meta },`)
  buf.line(`$release() { base.$release() },`)
  buf.blank()

  // Reactive sub-nodes.
  for (const f of rec.fields) {
    const { key } = reactiveKey(f.name)

    if (isListField(f)) {
      const elemRef = listItemRef(f)
      const elemTs = f.listItemRequired === false
        ? `(${mapTypeRef({ ...elemRef, required: true }, ctx)} | undefined)`
        : mapTypeRef(elemRef, ctx)
      const nType = itemNodeType(elemRef, ctx)
      const factory = itemFactoryExpr(elemRef, ctx)
      buf.line(
        `get ${key}(): SyncListNode<${elemTs}, ${nType}> { return createListNode(store, path + '.${f.name}', ${factory}) },`,
      )
    } else if (isMapField(f)) {
      const k = mapTypeRef(f.mapKey!, ctx)
      const v = mapTypeRef(f.mapValue!, ctx)
      const nType = valueNodeType(f.mapValue!, ctx)
      const factory = itemFactoryExpr(f.mapValue!, ctx)
      buf.line(
        `get ${key}(): SyncMapNode<${k}, ${v}, ${nType}> { return createMapNode(store, path + '.${f.name}', ${factory}) },`,
      )
    } else if (ctx.records[f.type]) {
      buf.line(
        `get ${key}(): ${f.type}Node { return create${f.type}Node(store, path + '.${f.name}') },`,
      )
    } else {
      const ts = mapFieldTypeOptional(f, ctx)
      buf.line(`get ${key}(): ISyncNode<${ts}> { return base._node('${f.name}') },`)
    }
  }
  buf.blank()

  // Snapshot accessors.
  for (const f of rec.fields) {
    const ts = mapFieldTypeOptional(f, ctx)
    const { key } = snapshotKey(f.name)
    buf.line(`get ${key}(): ${ts} { return base._get('${f.name}') as ${ts} },`)
  }

  // Bound actions.
  if (boundActions.length > 0) {
    buf.blank()
    for (const a of boundActions) {
      const inputTs = renderActionInputType(a, ctx)
      const outTs = renderActionOutputType(a, ctx)
      const arg = inputTs ? `input: ${inputTs}` : ''
      const passArg = inputTs ? `input` : `undefined`
      buf.line(
        `${camelCase(a.name)}: (${arg}): Promise<${outTs}> => base._act('${a.name}', ${passArg}) as Promise<${outTs}>,`,
      )
    }
  }

  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}

export function emitNodes(
  buf: LineBuffer,
  records: Record<string, IRRecord>,
  actions: Record<string, IRAction>,
  ctx: TypeContext,
) {
  const names = Object.keys(records).sort()
  for (const name of names) {
    const rec = records[name]
    const bound = scopedActionsFor(rec, actions)
    emitNodeInterface(buf, rec, ctx, bound)
    emitNodeFactory(buf, rec, ctx, bound)
  }
}
