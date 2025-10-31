# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT RULES

1. **We use BUN, not npm!** Always use `bun` commands, not `npm`
2. **DO NOT create .md documentation files** unless explicitly requested by the user
3. **ALWAYS test your changes** with `bun` before saying "it works" - run the actual commands to verify
4. **Main command is `bun start`** - this runs the interactive task selector
5. **TREE-SHAKING IS CRITICAL!** Always design packages with tree-shaking in mind (see Tree-Shaking Architecture section below)

## Project Overview

Alak is a proactive state management library for JavaScript/TypeScript built as a monorepo. The core architecture is based on "nucleons" (proactive containers), "atoms" (state management units), and "unions" (namespace-based dependency injection system).

**Key Concepts:**
- **Nucleus** (`@alaq/nucleus`): Core proactive container system - functions that hold values and notify subscribers
- **Atom** (`@alaq/atom`): State management layer built on nucleus - models with proactive properties
- **Alak** (`alak`): Union system for organizing atoms into namespaces with dependency injection
- **Vue Integration** (`@alaq/vue`): Vue 3 reactive bindings for atoms
- **Vite Plugin** (`@alaq/vite`): Development tooling for automatic code generation

## Version 6 (Planning - MAJOR REWRITE)

**Status**: Active planning and exploration phase. Version 6 represents a complete architectural reimagining of the proactive system.

### Core Direction

**Foundation**: All new packages will be based on the **Quark** pact (`@alaq/quark`), which provides:
- Hybrid initialization strategy (lazy in browser, eager in Node.js)
- Optimized performance characteristics
- Cleaner, more maintainable proactive primitive
- Better tree-shaking and bundle size

**Naming & Organization**: Moving toward unified `@alaq/*` namespace:
- All packages will use `@alaq/` scoped naming
- Consistent API patterns across packages
- Better alignment with modern JavaScript ecosystem conventions

### Open Questions (TBD)

The following critical architectural decisions are still under consideration:

1. **Package Scope**
   - Which packages from v5 will migrate to v6?
   - What new packages are needed?
   - What gets deprecated or merged?
   - **Status**: NOT YET DEFINED - scope is completely open

2. **Atom Architecture**
   - Internal structure of new atoms based on Quark
   - Separation of concerns: `state` vs `core` vs unified model
   - **Key Question**: Will there be a separate `state` object distinct from `core`, or will they be unified?
   - Property access patterns and API surface
   - **Status**: UNDER EXPLORATION - no decisions locked in

3. **Migration Strategy**
   - Breaking changes vs compatibility layers
   - Upgrade path from v5 to v6
   - Deprecation timeline for old patterns

### Implementation Guidelines

**IMPORTANT**: Do not ship or restructure packages for v6 without:
- ✅ Approved and documented package scope list
- ✅ Finalized atom architecture decisions
- ✅ Written migration guide and breaking changes documentation
- ✅ Explicit approval to proceed with specific changes

**Current Focus**: Exploration, prototyping, and architectural discussion. Treat all v6 work as experimental until scope and architecture are explicitly locked.

### V6 Package: NUCL Architecture

**`@alaq/nucl`** = Enhanced Quark with plugin system

#### Entry Points Strategy

1. **`@alaq/nucl`** (index) - Minimal core
   - `Nucl` constructor
   - `use()` plugin system
   - NO plugins pre-installed

2. **`@alaq/nucl/nucleus`** - Universal + basic types
   - Pre-installed: universal, array, object plugins
   - For most common use cases

3. **`@alaq/nucl/fusion`** - Computed values support
   - `Fusion` constructor - creates new Nucl from sources
   - `fusion()` utility - standalone reactive computation
   - Auto-cleanup when any source is destroyed

4. **`@alaq/nucl/heavy`** - All plugins (kitchen sink)
   - For prototyping / when bundle size doesn't matter

#### Fusion Strategy (Computed Values)

**Philosophy**: Fusion is **creation-only**, not mutation. You create a new Nucl by fusing sources together.

**Three APIs for different needs:**

**1. Fusion** - Simple default (alive strategy)
```typescript
import { Fusion } from '@alaq/nucl/fusion'

const user = Nucl(null)
const settings = Nucl(null)

// Short syntax: alive strategy by default
const profile = Fusion(user, settings, (u, s) => ({ ...u, ...s }))
// Recomputes only when sources are truthy
// Values unpacked: u, s (no .value needed)
```

**2. NeoFusion** - Advanced strategies (extensible builder)
```typescript
import { NeoFusion } from '@alaq/nucl/fusion'

const email = Nucl('')
const password = Nucl('')

// .any() - recompute on ALL changes (including falsy)
const isValid = NeoFusion(email, password).any((e, p) => {
  return e.length > 0 && p.length > 6
})

// .alive() - recompute only when truthy (same as Fusion)
const active = NeoFusion(enabled, data).alive((e, d) => e ? d : null)

// Future extensible strategies:
// .allTrue((a, b) => ...) - all sources must be true
// .settled((a, b) => ...) - all promises resolved/rejected
// .changed((a, b) => ...) - only if result differs from previous
// .custom(strategyDef, fn) - user-defined strategy
```

**3. Utilities** - Side-effects only (no Nucl returned)
```typescript
import { AliveFusion, AnyFusion } from '@alaq/nucl/fusion'

// Returns cleanup function, not Nucl
const stop1 = AliveFusion([data, user], (d, u) => console.log(d, u))
const stop2 = AnyFusion([count], (c) => syncToServer(c))

stop1()  // cleanup when done
```

**Strategy Descriptions:**

- **`alive`** (Fusion default) - Recompute only when sources are truthy
  - Skips: null, undefined, false, 0, '', NaN
  - Use: Conditional logic, waiting for data to be ready

- **`any`** - Recompute on ALL changes (including falsy)
  - Includes: all values, even null, undefined, 0, false
  - Use: Forms, validation, state machines, logging

**Extensibility Pattern:**

Strategies are designed to be easily extensible:

```typescript
// Internal strategy registry (conceptual)
const strategies = {
  alive: (sources) => sources.every(s => !!s.value),
  any: (sources) => true,  // always recompute

  // Future strategies can be added:
  allTrue: (sources) => sources.every(s => s.value === true),
  settled: (sources) => sources.every(s => isSettled(s.value)),
  changed: (sources, prevResult, newResult) => prevResult !== newResult
}

// User can add custom strategies:
NeoFusion.addStrategy('throttled', {
  shouldCompute: (sources, context) => {
    // custom throttle logic
  }
})
```

**Key principles:**
- ❌ NO `.fusion()` method on existing Nucl - fusion is creation only
- ✅ Fusion auto-destroys when ANY source calls `.decay()`
- ✅ Values unpacked in callback - no `.value` needed
- ✅ Lazy evaluation - computes only when `.value` accessed
- ✅ TypeScript infers types from sources automatically
- ✅ Strategy system designed for future extension

**Lifecycle & Memory Management:**
```typescript
const a = Nucl(1)
const b = Nucl(2)
const fused = Fusion(a, b, (av, bv) => av + bv)

// When ANY source decays:
a.decay()
// → fused automatically cleans up ALL subscriptions
// → fused.value becomes stale/undefined
// → prevents memory leaks automatically
```

**Why separate Fusion vs NeoFusion?**
- `Fusion(a, b, fn)` - 90% use case, shortest syntax, alive default
- `NeoFusion(a, b).strategy(fn)` - explicit strategies, extensible
- Avoids TypeScript overload/inference confusion
- Better tree-shaking: only import what you use
- Clear mental model: simple vs advanced

---

## Tree-Shaking Architecture

**CRITICAL PRINCIPLE**: Every package must be designed for optimal tree-shaking. Users should only pay for what they use.

### Core Rules

1. **Minimal index.ts exports**
   - `index.ts` exports ONLY the minimal core functionality
   - Advanced features MUST be in separate entry points
   - Never re-export everything from a plugins/features folder

2. **Explicit Entry Points**
   - Each feature group gets its own entry point
   - Define all entry points in `package.json` exports
   - Use direct imports: `import X from '@pkg/feature'` not `import { X } from '@pkg'`

3. **Plugin System Pattern**
   - Core provides minimal base + plugin system
   - Features are opt-in via `use(plugin)` or separate imports
   - Plugins must be in separate files for independent tree-shaking

### Package Entry Point Strategy

Every package follows this pattern:

#### **Minimal Entry** (`index.ts`)
```typescript
// @alaq/nucl/index.ts
import { Nucl } from './core'
export { Nucl, use } from './core'
export type * from './types'
```

Exports: Core functionality only. No plugins, no utilities.

#### **Feature Presets** (separate entry points)

**`/nucleus`** - Universal + simple types (array, object)
```typescript
// @alaq/nucl/nucleus
import { Nucl, use } from './core'
import { nucleusPlugin } from './nucleus-plugin'

// Single plugin for performance (not 3 separate plugins!)
use(nucleusPlugin)  // Includes: universal + array + object

export { Nucl, nucleusPlugin }
```

**Performance note:** Nucleus uses ONE combined plugin instead of three separate plugins (universal, array, object) for better performance:
- ✅ 1 `use()` call instead of 3
- ✅ 1 prototype extension instead of 3
- ✅ Less overhead, faster initialization

**`/fusion`** - Computed values support
```typescript
// @alaq/nucl/fusion
export { Nucl } from './core'
export { Fusion, NeoFusion, AliveFusion, AnyFusion } from './fusion'
```

**`/heavy`** - All plugins (kitchen sink)
```typescript
// @alaq/nucl/heavy
import { use } from './core'
import * as plugins from './plugins'  // Only in heavy preset!
Object.values(plugins).forEach(use)
export { Nucl } from './core'
```

#### **Custom Composition** (advanced users only)

For extreme granularity, you can import method collections directly (bypasses plugin system):

```typescript
import { Nucl } from '@alaq/nucl'
import { universalMethods } from '@alaq/nucl/plugins/universal'
import { arrayMethods } from '@alaq/nucl/plugins/array'

// Direct prototype extension (advanced)
Object.assign(Nucl.prototype, universalMethods, arrayMethods)
```

**Note:** This is rarely needed. Use presets (`/nucleus`, `/fusion`, `/heavy`) for 99% of cases.

### package.json Configuration

```json
{
  "name": "@alaq/nucl",
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "import": "./dist/index.js"
    },
    "./nucleus": {
      "types": "./types/presets/nucleus.d.ts",
      "import": "./dist/presets/nucleus.js"
    },
    "./computed": {
      "types": "./types/presets/computed.d.ts",
      "import": "./dist/presets/computed.js"
    },
    "./heavy": {
      "types": "./types/presets/heavy.d.ts",
      "import": "./dist/presets/heavy.js"
    },
    "./plugins/*": {
      "types": "./types/plugins/*.d.ts",
      "import": "./dist/plugins/*.js"
    }
  }
}
```

### Anti-Patterns (NEVER DO THIS)

❌ **Bad**: Re-exporting everything in index
```typescript
// plugins/index.ts - DON'T DO THIS
export * from './array'
export * from './object'
export * from './computed'
// Bundler imports all plugins even if unused
```

❌ **Bad**: Importing from barrel exports
```typescript
import { arrayPlugin, objectPlugin } from '@alaq/nucl/plugins'
// Forces bundler to load plugins/index which may import everything
```

✅ **Good**: Direct imports
```typescript
import { arrayPlugin } from '@alaq/nucl/plugins/array'
import { objectPlugin } from '@alaq/nucl/plugins/object'
// Bundler only loads these specific files
```

### Testing Tree-Shaking

For each package, verify tree-shaking works:

```bash
# Build a minimal test app
echo "import { Nucl } from '@alaq/nucl'; const x = Nucl(5)" > test.js

# Bundle and check size
bun build test.js --outfile=out.js --minify

# Verify heavy features are NOT in bundle
grep -q "computed" out.js && echo "❌ Tree-shaking failed" || echo "✅ OK"
```

---

## Monorepo Structure

The repository uses a custom build system (not Lerna/Nx). Packages in `packages/`:

- `nucleus` - Core proactive primitive
- `nucleon-ext` - Computed extensions for nucleus (from plugin)
- `atom` - State management layer
- `alak` - Union/DI system (depends on nucleus + atom)
- `vue` - Vue 3 integration
- `vite` - Vite plugin for dev tooling
- `rune` - Utility functions
- `bitmask` - Bitmask utilities
- `datastruct` - Data structures
- `svg` - SVG utilities
- `ws` - WebSocket utilities

## Development Commands

### Testing
```bash
# Run all tests across packages
bun test

# Run tests for a single package with bun:test
bun test packages/alak/test/listeners.test.ts
```

### Build System
```bash
# Interactive build system (select task and packages)
bun start

# Direct commands
bun start build      # Build packages
bun start rolldown   # Build with Rolldown (new bundler)
bun start test       # Run tests
bun start cover      # Test with coverage
bun start dev        # Development mode with watch
```

The `scripts/index.ts` provides an interactive CLI for selecting:
1. Task (build, rolldown, test, publish, etc.)
2. Projects (shows git-affected packages by default)

### Available Tasks

- **publish changes (...)** - Build and publish affected packages to npm
- **select for publish** - Manually select packages to publish
- **commit and push to git** - Run tests and push to git
- **build** - Local compile bundles (oxc-transform)
- **rolldown** - Build with Rolldown bundler (tree-shaking, source maps)
- **dev** - Run tests on file changes
- **test** - Fast test run
- **test + report** - Coverage test with report

### Code Formatting
```bash
bun run format
```

## Rolldown Build System

The project has a unified Rolldown configuration system (`scripts/rolldown/unified.config.ts`) that:

- **Zero configuration** - Automatically creates build config based on package structure
- **Auto-detects entry points**:
  - `src/index.ts` → Universal build (works in Node.js and Browser)
  - `src/index.node.ts` + `src/index.browser.ts` → Platform-specific builds
- **Handles types/** folder - Combines all `.d.ts` files into single `types.d.ts`
- **Generates multiple formats** - ESM, CJS, UMD (based on package.json)
- **Tree-shaking and optimization** - Smaller bundle sizes than oxc-transform

Types handling:
1. Reads all `.d.ts` from `packages/*/types/`
2. Combines into `artifacts/*/types.d.ts`
3. Adds `/// <reference path="types.d.ts" />` to `index.d.ts`
4. TypeScript loads everything through this reference chain

Usage:
```bash
bun start rolldown
```

This will build ALL packages. The system automatically selects the right configuration for each package.

### Git Commit Guidelines

When creating git commits:
- **DO NOT** add "🤖 Generated with [Claude Code]" signature
- **DO NOT** add "Co-Authored-By: Claude <noreply@anthropic.com>" footer
- Keep commit messages concise and focused on the changes
- Use conventional commit format: `type(scope): description`

## Architecture Patterns

### TypeScript Path Aliases
The project uses path aliases (defined in `tsconfig.json`):
- `alak/*` → `packages/alak/src/*`
- `@alaq/nucleus/*` → `packages/nucleus/src/*`
- `@alaq/atom/*` → `packages/atom/src/*`
- `@alaq/rune/*` → `packages/rune/src/*`
- etc.

When importing between packages, use these aliases, not relative paths.

### Union System Architecture

**Core Pattern**: Unions are namespaced dependency containers that manage atoms.

```typescript
// Get or create a union namespace
const union = GetUnionCore('myNamespace')

// Add atoms to the union
const myAtom = union.addAtom(MyModelConstructor)

// Access through facade with smart property resolution
union.facade.myModelCore    // accesses atom.core
union.facade.myModelState   // accesses atom.state
union.facade.myModelAtom    // accesses the atom itself
union.facade.cores.myModel  // alternative access to core
```

**Facade Resolution** (see `packages/alak/src/UnionCore.ts:34-59`):
- Properties ending in `Core`, `State`, `Atom`, `Bus` are resolved to the corresponding atom property
- Special linked facades: `cores`, `buses`, `states`, `actions` provide grouped access

### Listener Naming Convention

The `listeners.ts` system uses underscore-prefixed method names for auto-wiring:

- `_nucleusName_listenerType` - Subscribe to nucleus in same atom
- `_$moduleName_nucleusName_listenerType` - Subscribe to another atom's nucleus
- `_on_eventName` - Register as event listener (converted to SNAKE_CASE)

Example:
```typescript
class MyModel {
  count = 0

  // Auto-subscribes to this.count nucleus
  _count_up() { /* called when count changes */ }

  // Event listener for SOME_EVENT
  _on_someEvent() { /* handles event */ }

  // Subscribe to another atom
  _$otherAtom_value_up() { /* reacts to otherAtom.value */ }
}
```

### Atom Structure

Atoms created via `Atom({ model })` or `UnionAtom` provide:
- `atom.core[key]` - Access to nucleus (reactive container) for each property
- `atom.state[key]` - Current values
- `atom.actions[key]` - Action methods from the model
- `atom.known.values()` - Get all state values as object

## Build Output

Each package builds to multiple formats:
- `index.js` - Main entry (CommonJS)
- `index.d.ts` - TypeScript definitions
- `lib/es.js` - ES module build
- `lib/umd.js` - UMD browser build

TypeScript declarations are generated via `tsc` with `emitDeclarationOnly: true`.

## Testing Notes

- Uses `tap` testing framework
- Test files: `packages/*/test/*.test.ts`
- Tests run with TypeScript via tap's built-in loader

## Important Implementation Details

1. **Nucleus as Proactive Primitive**: The nucleus (N/Nucleus function) is the foundation. It's a callable container that both sets and gets values, with subscription methods like `.up()`, `.down()`, etc.

2. **Dependency Injection via Facades**: The union facade uses Proxy handlers to provide convenient property access patterns rather than explicit injection.

3. **Build System is Custom**: Don't assume standard monorepo tools. The build orchestration is in `scripts/` using custom TypeScript.

4. **Version Management**: Package versions are kept in sync (currently 5.x; v6 in planning). The build system handles version bumping across packages.
