// Capability manifest generator.
//
// Per AI_FIRST.md §3 (Capability manifest ≤ 2 KB gzipped) and DESIGN.md §5,
// `alaq` with no arguments prints a compact JSON payload describing the
// ecosystem at the installed version. Agents paste this into context.
//
// Data source: repo-local architecture.yaml when available (monorepo checkout),
// else a frozen snapshot bundled with this package. The snapshot is minimal —
// it lists only what an agent needs to know on first contact.
//
// Size budget: ≤ 2 KB gzipped, ~1.5 KB typical. No prose, no examples, no
// markdown — those live in `alaq mcp list` and per-package README.

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface CapabilityManifest {
  alaq: { version: string; node: string; bun: string }
  ecosystem: {
    version: string
    packages: Array<{ name: string; role: string; layer: string }>
  }
  mcp: {
    server: string
    tool_groups: {
      compile_time: string[]
      runtime_observation: string[]
    }
    transport: 'stdio'
  }
  hints: {
    first_call_for_agents: string
    wire_up: string
    schema_dir_default: string
  }
}

const VERSION = '6.0.0-alpha.0'

// Snapshot for agent's first contact. Deliberately not exhaustive — 8 entries
// vs ~22 in architecture.yaml. Utilities and UI adapters are not first-contact
// concerns; they surface via `alaq --full` (future) or package.yaml reads.
const SNAPSHOT: CapabilityManifest = {
  alaq: { version: VERSION, node: '>=20', bun: '>=1.3' },
  ecosystem: {
    version: VERSION,
    packages: [
      { name: '@alaq/graph', role: 'spec-core', layer: 'compile-time' },
      { name: '@alaq/mcp', role: 'ai-tooling', layer: 'tooling' },
      { name: '@alaq/quark', role: 'core-primitive', layer: 'runtime' },
      { name: '@alaq/nucl', role: 'primitive', layer: 'runtime' },
      { name: '@alaq/atom', role: 'state-model', layer: 'runtime' },
      { name: '@alaq/plugin-logi', role: 'plugin-observability', layer: 'runtime' },
      { name: '@alaq/plugin-idb', role: 'plugin-persistence', layer: 'runtime' },
      { name: '@alaq/plugin-tauri', role: 'plugin-ipc', layer: 'runtime' },
    ],
  },
  mcp: {
    server: '@alaq/mcp',
    tool_groups: {
      compile_time: ['schema_compile', 'schema_diff'],
      runtime_observation: [
        'alaq_capabilities',
        'alaq_trace',
        'alaq_atom_activity',
        'alaq_hot_atoms',
        'alaq_idb_stores',
        'alaq_idb_store_stats',
        'alaq_idb_errors',
      ],
    },
    transport: 'stdio',
  },
  hints: {
    first_call_for_agents: 'alaq_capabilities',
    wire_up: 'alaq mcp install',
    schema_dir_default: './schema',
  },
}

/**
 * Returns the capability manifest. Falls back to the bundled snapshot if
 * architecture.yaml is not resolvable (published tarball, no monorepo).
 *
 * Deterministic: sorts keys lexicographically for diffable output across
 * versions. Two agents comparing alaq@6.0.0-alpha.0 vs alaq@6.0.0-beta.1
 * see exactly what changed, line-by-line.
 */
export function readManifest(): CapabilityManifest {
  return sortDeep(SNAPSHOT) as CapabilityManifest
}

/**
 * Same as readManifest but includes every package from architecture.yaml
 * (not the 8-entry snapshot). Used by `alaq --full` / `alaq --pretty`.
 *
 * Returns snapshot unchanged when architecture.yaml cannot be resolved.
 */
export function readManifestFull(): CapabilityManifest {
  const yamlPath = findArchitectureYaml()
  if (!yamlPath) return readManifest()
  try {
    const txt = readFileSync(yamlPath, 'utf8')
    const pkgs = parseArchitectureYaml(txt)
    if (pkgs.length === 0) return readManifest()
    const expanded: CapabilityManifest = {
      ...SNAPSHOT,
      ecosystem: { version: VERSION, packages: pkgs },
    }
    return sortDeep(expanded) as CapabilityManifest
  } catch {
    return readManifest()
  }
}

/**
 * Encodes the manifest as a single-line compact JSON string.
 * The default for non-TTY stdout. ≤ 2 KB gzipped target.
 */
export function renderManifestCompact(m: CapabilityManifest): string {
  return JSON.stringify(m)
}

/**
 * Encodes the manifest as indented JSON. Used with --pretty.
 */
export function renderManifestPretty(m: CapabilityManifest): string {
  return JSON.stringify(m, null, 2)
}

// ── internals ──────────────────────────────────────────────────────────────

function findArchitectureYaml(): string | null {
  // Ascend from the package dir looking for monorepo root.
  // Works under Bun (import.meta.url) and Node (same mechanism post-ESM).
  let here: string
  try {
    here = dirname(fileURLToPath(import.meta.url))
  } catch {
    // Fallback for environments without import.meta.url (bundled).
    here = process.cwd()
  }
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(here, 'architecture.yaml')
    if (existsSync(candidate)) return candidate
    const parent = resolve(here, '..')
    if (parent === here) break
    here = parent
  }
  return null
}

// Minimal YAML subset for architecture.yaml's `packages:` list. Avoids adding
// a yaml dependency — we own the shape of architecture.yaml in this repo.
//
// Extracts entries of the form:
//   - name: "@alaq/foo"
//     role: bar
//     layer: baz
function parseArchitectureYaml(txt: string): Array<{ name: string; role: string; layer: string }> {
  const out: Array<{ name: string; role: string; layer: string }> = []
  const lines = txt.split(/\r?\n/)
  let inPackages = false
  let cur: Partial<{ name: string; role: string; layer: string }> = {}
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (/^packages:\s*$/.test(line)) {
      inPackages = true
      continue
    }
    if (!inPackages) continue
    if (/^[a-zA-Z_][a-zA-Z0-9_]*:/.test(line) && !line.startsWith(' ')) {
      // Left top-level block.
      inPackages = false
      continue
    }
    const entry = line.match(/^\s*-\s*name:\s*['"]?([^'"\s]+)['"]?\s*$/)
    if (entry) {
      if (cur.name) pushIfComplete(out, cur)
      cur = { name: entry[1] }
      continue
    }
    const role = line.match(/^\s+role:\s*([^\s#]+)/)
    if (role && cur.name) cur.role = role[1]
    const layer = line.match(/^\s+layer:\s*([^\s#]+)/)
    if (layer && cur.name) cur.layer = layer[1]
  }
  if (cur.name) pushIfComplete(out, cur)
  return out
}

function pushIfComplete(
  out: Array<{ name: string; role: string; layer: string }>,
  cur: Partial<{ name: string; role: string; layer: string }>,
): void {
  if (cur.name && cur.role) {
    out.push({ name: cur.name, role: cur.role, layer: cur.layer ?? 'unspecified' })
  }
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const k of Object.keys(v).sort()) o[k] = sortDeep((v as Record<string, unknown>)[k])
    return o
  }
  return v
}
