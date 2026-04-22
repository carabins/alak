// @alaq/graph-tauri-rs — `register.rs` emitter.
//
// Emits a `register_<ns>_commands!` macro that expands into
// `tauri::generate_handler![ … ]` with every SDL action listed. The macro
// form — not a function — is required because `tauri::generate_handler!`
// consumes its arguments at macro-expansion time; a plain function cannot
// forward identifiers through. User code then writes:
//
//   tauri::Builder::default()
//     .invoke_handler(arsenal::register_arsenal_commands!())
//     .run(…)
//
// Rationale (Tauri 2 API check):
//   - `tauri::generate_handler!` is the blessed v2 entrypoint — it still
//     takes a comma-separated list of command function idents. See Tauri
//     v2 docs §"Commands" and `src-tauri/src/lib.rs` sample.
//   - `tauri::Invoke<R>` is v1 vocabulary; v2 threads commands through
//     `Builder::invoke_handler` which wants the output of
//     `tauri::generate_handler![ … ]`. A macro that *produces* that output
//     is the cleanest generator-side contract.
//   - No runtime crate fallback path needed — `generate_handler!` is
//     stable in v2.

import type { IRAction } from '@alaq/graph'
import { LineBuffer, snakeCase, nsFlat } from './utils'

/** Macro name: `register_<ns_flat>_commands`. */
export function registerMacroName(namespace: string): string {
  return `register_${nsFlat(namespace)}_commands`
}

export function emitRegister(
  buf: LineBuffer,
  namespace: string,
  actions: Record<string, IRAction>,
) {
  const names = Object.keys(actions).sort()
  const macroName = registerMacroName(namespace)

  buf.line(`/// Expand into a Tauri \`invoke_handler\` capable of serving every`)
  buf.line(`/// command generated for this namespace.`)
  buf.line(`///`)
  buf.line(`/// Usage:`)
  buf.line(`/// \`\`\`ignore`)
  buf.line(`/// tauri::Builder::default()`)
  buf.line(`///     .manage::<std::sync::Arc<dyn ${/* hint only */ ''}Handlers>>(handlers)`)
  buf.line(`///     .invoke_handler(${macroName}!())`)
  buf.line(`///     .run(tauri::generate_context!())`)
  buf.line(`///     .expect("tauri run");`)
  buf.line(`/// \`\`\``)
  buf.line(`#[macro_export]`)
  buf.line(`macro_rules! ${macroName} {`)
  buf.indent()
  buf.line(`() => {`)
  buf.indent()
  buf.line(`tauri::generate_handler![`)
  buf.indent()
  for (const n of names) {
    // commands live in the same `commands` module — but since generate_handler!
    // resolves idents in the caller's scope, we qualify through `$crate` of the
    // user crate. We emit bare idents; the user's `mod.rs` re-exports them.
    // The `use super::*` pattern in mod.rs keeps this ergonomic.
    buf.line(`$crate::${nsFlat(namespace)}::commands::${snakeCase(n)},`)
  }
  buf.dedent()
  buf.line(`]`)
  buf.dedent()
  buf.line(`}`)
  buf.dedent()
  buf.line(`}`)
  buf.blank()
}
