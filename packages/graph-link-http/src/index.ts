// @alaq/graph-link-http — TS client generator.
//
// Emits one file per namespace: `<ns>.http.generated.ts`. Each file contains:
//   · enum string-literal unions (`type Channel = 'master' | 'test' | 'dev'`)
//   · record interfaces (`export interface IPackageMeta { … }`)
//   · per-action input interfaces (`export interface IPackagesInput { … }`)
//   · per-action free fn `export async function packages(options, input)`
//   · `createHttpApi(options)` factory returning `{ packages, versions, delete, … }`
//
// Wave 0 (2026-04-24) — complete rewrite against the real IR shape
// (`packages/graph/src/types.ts:272-336`). Previous implementation walked
// `type.kind` branches which don't exist in IR v0.3+ — all non-scalar types
// silently degraded to `I${name}` without list/optional/map handling.
//
// Conventions:
//   · record + input prefix `I` — kept for Wave 0 to avoid cli-ui churn,
//     scheduled to drop in Wave 2 with @alaq/codegen-util extraction.
//   · enum — bare name, NO `I` prefix. Emitted as string-literal union so
//     the wire format matches axum's `#[serde(rename_all = "snake_case")]`.
//   · action free-fn names are JS-reserved-safe via `tsIdent` mangling
//     (trailing `_` on collision). Factory object keys keep the unmangled
//     camelCase name — JS allows `obj.delete` as key even when a function
//     named `delete` is illegal.
//   · action wire name stays snake_case (`packages/graph-axum` expects it).
//
// IR shape reminder (packages/graph/src/types.ts):
//   IRField   = { name, type: string, required, list, listItemRequired?,
//                 map?, mapKey?: IRTypeRef, mapValue?: IRTypeRef }
//   IRAction  = { name, input?: IRField[], output?: string,
//                 outputRequired?, outputList?, outputListItemRequired? }
//   IRTypeRef = { type, required, list, listItemRequired?, map?, mapKey?,
//                 mapValue? }
//
// `type: string` is always a bare identifier — the base name (`String`,
// `Timestamp`, `PackageMeta`, `Channel`, …). Never a nested object.

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
  /** Import path for `callAction` / `HttpClientOptions`. Default
   *  `@alaq/link-http-client`. */
  clientImport?: string;
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
  const clientImport = options.clientImport || '@alaq/link-http-client';

  const namespaces = options.namespace
    ? [options.namespace]
    : Object.keys(ir.schemas).sort();

  for (const nsName of namespaces) {
    const schema = ir.schemas[nsName];
    if (!schema) continue;

    files.push({
      path: `${schema.namespace}.http.generated.ts`,
      content: generateNamespace(schema, { header, clientImport }),
    });
  }

  return { files };
}

// ────────────────────────────────────────────────────────────────
// Built-in scalar mapping — mirrors @alaq/graph-axum for consistency
// ────────────────────────────────────────────────────────────────

const BUILTIN_STRING = new Set(['ID', 'String', 'UUID', 'Bytes']);
const BUILTIN_NUMBER = new Set(['Int', 'Float', 'Timestamp', 'Duration']);
const BUILTIN_BOOLEAN = new Set(['Boolean']);

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
  if (BUILTIN_STRING.has(name)) return 'string';
  if (BUILTIN_NUMBER.has(name)) return 'number';
  if (BUILTIN_BOOLEAN.has(name)) return 'boolean';
  if (ctx.scalars[name]) return 'string';
  if (ctx.enums[name]) return name;
  if (ctx.records[name]) return `I${name}`;
  return name;
}

// TS postfix `[]` binds tighter than `|`, so `T | null[]` parses as
// `T | (null[])` — wrong. Parenthesise the union before wrapping in `[]`.
function mapTypeRef(ref: IRTypeRef, ctx: TypeContext): string {
  if (ref.map) {
    const k = mapTypeRef(ref.mapKey!, ctx);
    const v = mapTypeRef(ref.mapValue!, ctx);
    const inner = `Record<${k}, ${v}>`;
    return ref.required ? inner : `${inner} | null`;
  }
  const base = mapBaseType(ref.type, ctx);
  if (ref.list) {
    const item = ref.listItemRequired !== false ? base : `(${base} | null)`;
    const arr = `${item}[]`;
    return ref.required ? arr : `${arr} | null`;
  }
  return ref.required ? base : `${base} | null`;
}

function mapFieldType(field: IRField, ctx: TypeContext): string {
  if (field.map) {
    const k = mapTypeRef(field.mapKey!, ctx);
    const v = mapTypeRef(field.mapValue!, ctx);
    const inner = `Record<${k}, ${v}>`;
    return field.required ? inner : `${inner} | null`;
  }
  const base = mapBaseType(field.type, ctx);
  if (field.list) {
    const item = field.listItemRequired !== false ? base : `(${base} | null)`;
    const arr = `${item}[]`;
    return field.required ? arr : `${arr} | null`;
  }
  return field.required ? base : `${base} | null`;
}

function mapActionOutputType(action: IRAction, ctx: TypeContext): string {
  if (!action.output) return 'void';
  const base = mapBaseType(action.output, ctx);
  const required = action.outputRequired === true;
  if (action.outputList === true) {
    const itemRequired = action.outputListItemRequired !== false;
    const item = itemRequired ? base : `(${base} | null)`;
    const arr = `${item}[]`;
    return required ? arr : `${arr} | null`;
  }
  return required ? base : `${base} | null`;
}

// ────────────────────────────────────────────────────────────────
// JS reserved-word mangling
// ────────────────────────────────────────────────────────────────

// Strict-mode reserved + future-reserved + the `let`/`static`/etc. that are
// illegal as `function` names. Keys that are merely contextual (`as`, `from`)
// are safe — we only care about identifier binding sites.
const JS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield',
  // strict-mode reserved (fail as `function <name>` in strict modules):
  'let', 'static', 'implements', 'interface', 'package', 'private',
  'protected', 'public',
  // future-reserved (historic):
  'await', 'arguments', 'eval',
]);

/** Return a JS-safe identifier; appends `_` on reserved-word collision. */
function tsIdent(name: string): string {
  return JS_RESERVED.has(name) ? `${name}_` : name;
}

function camelCase(s: string): string {
  if (!s) return s;
  return s[0].toLowerCase() + s.slice(1);
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

// ────────────────────────────────────────────────────────────────
// Namespace emitter
// ────────────────────────────────────────────────────────────────

function generateNamespace(
  ns: IRSchema,
  opts: { header: boolean; clientImport: string },
): string {
  const ctx = buildTypeContext(ns);
  const lines: string[] = [];

  if (opts.header) {
    lines.push(`/**`);
    lines.push(` * @generated by @alaq/graph-link-http`);
    lines.push(` * Namespace: ${ns.namespace}`);
    lines.push(` */`);
  }

  lines.push(`import { callAction, type HttpClientOptions } from '${opts.clientImport}';`);
  lines.push(``);

  // Enums — string-literal union. Matches axum's snake_case wire format.
  for (const e of Object.values(ns.enums)) {
    const union = e.values.map(v => `'${v}'`).join(' | ') || 'never';
    lines.push(`export type ${e.name} = ${union};`);
    lines.push(``);
  }

  // Records
  for (const r of Object.values(ns.records)) {
    lines.push(`export interface I${r.name} {`);
    for (const f of r.fields) {
      const ty = mapFieldType(f, ctx);
      const marker = f.required ? '' : '?';
      lines.push(`  readonly ${f.name}${marker}: ${ty};`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Per-action input interfaces. Empty-input actions still get an interface
  // (empty), so call-sites can reference `IPingInput` uniformly.
  for (const a of Object.values(ns.actions)) {
    lines.push(`export interface I${a.name}Input {`);
    for (const f of a.input ?? []) {
      const ty = mapFieldType(f, ctx);
      const marker = f.required ? '' : '?';
      lines.push(`  readonly ${f.name}${marker}: ${ty};`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  // Per-action free functions.
  for (const a of Object.values(ns.actions)) {
    const outTy = mapActionOutputType(a, ctx);
    const fnName = tsIdent(camelCase(a.name));
    lines.push(`export async function ${fnName}(`);
    lines.push(`  options: HttpClientOptions,`);
    lines.push(`  input: I${a.name}Input,`);
    lines.push(`): Promise<${outTy}> {`);
    lines.push(`  return callAction<I${a.name}Input, ${outTy}>(options, '${snakeCase(a.name)}', input);`);
    lines.push(`}`);
    lines.push(``);
  }

  // Factory. Object keys stay unmangled (`api.delete` is valid property
  // access even when `function delete` is illegal — see ECMAScript spec on
  // MemberExpression vs IdentifierReference).
  lines.push(`export function createHttpApi(options: HttpClientOptions) {`);
  lines.push(`  return {`);
  for (const a of Object.values(ns.actions)) {
    const key = camelCase(a.name);
    const fnName = tsIdent(key);
    lines.push(`    ${key}: (input: I${a.name}Input) => ${fnName}(options, input),`);
  }
  lines.push(`  };`);
  lines.push(`}`);

  return lines.join('\n');
}
