// @alaq/graph-link-http-rs — Rust client generator.
//
// Emits one file per namespace: `<ns_flat>/mod.rs`. Each file contains:
//   · enum definitions with `#[serde(rename_all = "...")]` picked from SDL casing
//   · record structs with full derives
//   · per-action input structs
//   · a `<Ns>Client` struct with async methods per action
//
// Wave 0 (2026-04-24) — complete rewrite against the real IR shape
// (`packages/graph/src/types.ts:272-336`). Previous implementation checked
// `type.kind` branches that don't exist in the IR, so lists degraded to
// bare names (`VersionRef` where `Vec<VersionRef>` was wanted), and
// non-scalar built-ins like `Timestamp` / `Int` emitted as unknown types.
//
// Scalar/type/optionality logic mirrors @alaq/graph-axum so server and
// client types line up on the wire. Rust keyword collisions are handled via
// `r#keyword` raw-identifier prefix.

import type {
  IR,
  IRAction,
  IREnum,
  IRField,
  IRRecord,
  IRSchema,
  IRTypeRef,
} from '@alaq/graph';

// ────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Emit the `@generated` banner per file. Default true. */
  header?: boolean;
  /** Name of the runtime crate to import from (HttpClient, AlaqHttpError).
   *  Accepts dash or underscore style; normalised to underscores. Default
   *  `alaq-link-http-client`. */
  rtCrate?: string;
  /** Target one namespace. When omitted, every namespace in the IR is emitted. */
  namespace?: string;
}

export interface GenerateFile {
  path: string;
  content: string;
}

export interface GenerateResult {
  files: GenerateFile[];
}

export function generate(ir: IR, options: GenerateOptions = {}): GenerateResult {
  const files: GenerateFile[] = [];
  const header = options.header !== false;
  const rtCrate = (options.rtCrate || 'alaq-link-http-client').replace(/-/g, '_');

  const namespaces = options.namespace
    ? [options.namespace]
    : Object.keys(ir.schemas).sort();

  for (const nsName of namespaces) {
    const schema = ir.schemas[nsName];
    if (!schema) continue;

    const dirName = schema.namespace.replace(/\./g, '_');
    files.push({
      path: `${dirName}/mod.rs`,
      content: generateMod(schema, { header, rtCrate }),
    });
  }

  return { files };
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping — mirrors @alaq/graph-axum verbatim
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID']);
const BUILTIN_I64 = new Set(['Int', 'Timestamp', 'Duration']);
const BUILTIN_F64 = new Set(['Float']);
const BUILTIN_BOOL = new Set(['Boolean']);

interface TypeContext {
  enums: Record<string, IREnum>;
  records: Record<string, IRRecord>;
  scalars: Record<string, { name: string }>;
}

function buildTypeContext(schema: IRSchema): TypeContext {
  return {
    enums: schema.enums,
    records: schema.records,
    scalars: schema.scalars,
  };
}

function mapBaseType(name: string, ctx: TypeContext): string {
  if (ctx.scalars[name]) return name;
  if (BUILTIN_STRING.has(name)) return 'String';
  if (BUILTIN_I64.has(name)) return 'i64';
  if (BUILTIN_F64.has(name)) return 'f64';
  if (BUILTIN_BOOL.has(name)) return 'bool';
  if (name === 'Bytes') return 'Vec<u8>';
  if (ctx.enums[name]) return name;
  if (ctx.records[name]) return name;
  return name;
}

function mapTypeRef(ref: IRTypeRef, ctx: TypeContext): string {
  if (ref.map) {
    const k = mapTypeRef(ref.mapKey!, ctx);
    const v = mapTypeRef(ref.mapValue!, ctx);
    const inner = `std::collections::HashMap<${k}, ${v}>`;
    return ref.required ? inner : `Option<${inner}>`;
  }
  const base = mapBaseType(ref.type, ctx);
  if (ref.list) {
    const itemRequired = ref.listItemRequired !== false;
    const item = itemRequired ? base : `Option<${base}>`;
    const vec = `Vec<${item}>`;
    return ref.required ? vec : `Option<${vec}>`;
  }
  return ref.required ? base : `Option<${base}>`;
}

function mapFieldType(field: IRField, ctx: TypeContext): string {
  if (field.map) {
    const k = mapTypeRef(field.mapKey!, ctx);
    const v = mapTypeRef(field.mapValue!, ctx);
    const inner = `std::collections::HashMap<${k}, ${v}>`;
    return field.required ? inner : `Option<${inner}>`;
  }
  const base = mapBaseType(field.type, ctx);
  if (field.list) {
    const itemRequired = field.listItemRequired !== false;
    const item = itemRequired ? base : `Option<${base}>`;
    const vec = `Vec<${item}>`;
    return field.required ? vec : `Option<${vec}>`;
  }
  return field.required ? base : `Option<${base}>`;
}

function mapActionOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return '()';
  const required = action.outputRequired === true;
  const base = mapBaseType(action.output, ctx);
  if (action.outputList === true) {
    const itemRequired = action.outputListItemRequired !== false;
    const item = itemRequired ? base : `Option<${base}>`;
    const vec = `Vec<${item}>`;
    return required ? vec : `Option<${vec}>`;
  }
  return required ? base : `Option<${base}>`;
}

// ────────────────────────────────────────────────────────────────
// Rust identifier helpers
// ────────────────────────────────────────────────────────────────

const RUST_KEYWORDS = new Set([
  'as', 'break', 'const', 'continue', 'crate', 'else', 'enum', 'extern',
  'false', 'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod',
  'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static', 'struct',
  'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while',
  'async', 'await', 'dyn', 'abstract', 'become', 'box', 'do', 'final',
  'macro', 'override', 'priv', 'typeof', 'unsized', 'virtual', 'yield', 'try',
]);

/** Prefix `r#` on a Rust keyword so it's usable as an identifier. */
function rustIdent(name: string): string {
  return RUST_KEYWORDS.has(name) ? `r#${name}` : name;
}

function pascalCase(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

function snakeCase(s: string): string {
  if (!s) return s;
  if (/^[a-z0-9_]+$/.test(s)) return s;
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = s[i - 1];
    if (c >= 'A' && c <= 'Z') {
      if (i > 0 && prev && !(prev >= 'A' && prev <= 'Z') && prev !== '_') {
        out.push('_');
      }
      out.push(c.toLowerCase());
    } else if (c === '-') {
      out.push('_');
    } else {
      out.push(c);
    }
  }
  return out.join('');
}

function pickEnumRenameAll(values: string[]): 'snake_case' | 'SCREAMING_SNAKE_CASE' {
  if (values.length === 0) return 'SCREAMING_SNAKE_CASE';
  return values.every(v => /^[a-z][a-z0-9_]*$/.test(v))
    ? 'snake_case'
    : 'SCREAMING_SNAKE_CASE';
}

function enumVariantName(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(p => p[0].toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

// ────────────────────────────────────────────────────────────────
// Namespace emitter
// ────────────────────────────────────────────────────────────────

function generateMod(
  ns: IRSchema,
  opts: { header: boolean; rtCrate: string },
): string {
  const ctx = buildTypeContext(ns);
  const lines: string[] = [];

  if (opts.header) {
    lines.push(`/*`);
    lines.push(` * @generated by @alaq/graph-link-http-rs`);
    lines.push(` * Namespace: ${ns.namespace}`);
    lines.push(` */`);
  }

  lines.push(`use serde::{Deserialize, Serialize};`);
  lines.push(`use ${opts.rtCrate}::{HttpClient, AlaqHttpError};`);
  lines.push(``);

  // Enums — PascalCase variants + serde rename_all to preserve wire casing.
  for (const e of Object.values(ns.enums)) {
    const renameAll = pickEnumRenameAll(e.values);
    lines.push(`#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]`);
    lines.push(`#[serde(rename_all = "${renameAll}")]`);
    lines.push(`pub enum ${e.name} {`);
    for (const v of e.values) {
      lines.push(`    ${enumVariantName(v)},`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Records — full derives, PartialEq for ergonomics.
  for (const r of Object.values(ns.records)) {
    lines.push(`#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]`);
    lines.push(`pub struct ${r.name} {`);
    for (const f of r.fields) {
      const ty = mapFieldType(f, ctx);
      lines.push(`    pub ${rustIdent(f.name)}: ${ty},`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Per-action input structs. Drop blanket Default — callers construct
  // explicitly, and enum fields don't have Default in general.
  for (const a of Object.values(ns.actions)) {
    lines.push(`#[derive(Debug, Clone, Serialize, Deserialize)]`);
    lines.push(`pub struct ${a.name}Input {`);
    for (const f of a.input ?? []) {
      const ty = mapFieldType(f, ctx);
      lines.push(`    pub ${rustIdent(f.name)}: ${ty},`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Client struct — one per namespace. Name derived from the last namespace
  // segment for readability (e.g. `rest.valkyrie.arsenal` → `ArsenalClient`).
  const rawName = ns.namespace.split('.').pop() || 'Client';
  const clientName = `${pascalCase(rawName)}Client`;
  lines.push(`pub struct ${clientName} {`);
  lines.push(`    inner: HttpClient,`);
  lines.push(`}`);
  lines.push(``);

  lines.push(`impl ${clientName} {`);
  lines.push(`    pub fn new(base_url: String) -> Self {`);
  lines.push(`        Self { inner: HttpClient::new(base_url) }`);
  lines.push(`    }`);
  lines.push(``);
  lines.push(`    pub fn with_token(mut self, token: String) -> Self {`);
  lines.push(`        self.inner = self.inner.with_token(token);`);
  lines.push(`        self`);
  lines.push(`    }`);
  lines.push(``);

  for (const a of Object.values(ns.actions)) {
    const outTy = mapActionOutputType(a, ctx);
    const methodName = rustIdent(snakeCase(a.name));
    lines.push(`    pub async fn ${methodName}(&self, input: ${a.name}Input) -> Result<${outTy}, AlaqHttpError> {`);
    lines.push(`        self.inner.call_action("${snakeCase(a.name)}", input).await`);
    lines.push(`    }`);
    lines.push(``);
  }
  lines.push(`}`);

  return lines.join('\n');
}
