# CRITICAL: Package Creation & Maintenance Guidelines

**IMPORTANT**: These rules are MANDATORY when creating or modifying packages.

---

## Core Principle: Separation of Source and Built package.json

The build system uses a **two-stage approach**:

1. **Source package.json** (in packages/*/package.json) = Source code, minimal
2. **Built package.json** (generated at build time) = Complete manifest with metadata

**WHY?** Single source of truth. File structure → Build script → exports map

---

## Rule 1: Forbidden Fields in Source package.json

These fields **WILL BE GENERATED** by build script. **NEVER include them in source:**

- ❌ `"exports"` — Auto-detected from src/ directory structure
- ❌ `"license"` — Generated as "MIT"
- ❌ `"author"` — Generated as "Alak Contributors"
- ❌ `"repository"` — Generated with directory path
- ❌ `"files"` — Generated as ["lib", "types", "README.md"]
- ❌ `"peerDependencies"` — Generated based on file imports
- ❌ `"main"` — Generated based on build output
- ❌ `"types"` — Generated as types/index.d.ts

**If you see ANY of these in source package.json, it's DIRTY and needs cleanup.**

---

## Rule 2: Build System Generates Complete package.json

The build process reads:
- Source `package.json` (minimal)
- Source `src/` directory structure
- Root configuration

And generates into `artifacts/package-name/package.json`:
- All forbidden fields (see Rule 1)
- Complete `exports` map based on file structure
- Correct dependency declarations

**This is automatic. You provide structure, build creates manifest.**

---

## Rule 3: Exports Defined by Directory Structure

**The exports are inferred from your src/ directory, NOT hardcoded.**

Directory structure declares exports:

```
packages/your-package/src/
├── index.ts                    → export "."
├── index.browser.ts            → platform-specific "."
├── index.node.ts               → platform-specific "."
├── presets/
│   ├── nucleus.ts              → export "./nucleus"
│   └── fusion.ts               → export "./fusion"
└── plugins/
    ├── array.ts                → export "./plugins/array"
    └── universal.ts            → export "./plugins/universal"
```

Build script sees this structure and generates:

```json
{
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "node": "./lib/index.node.js",
      "browser": "./lib/index.browser.js",
      "import": "./lib/index.js"
    },
    "./nucleus": {
      "types": "./types/presets/nucleus.d.ts",
      "import": "./lib/presets/nucleus.js"
    },
    "./fusion": {
      "types": "./types/presets/fusion.d.ts",
      "import": "./lib/presets/fusion.js"
    },
    "./plugins/array": {
      "types": "./types/plugins/array.d.ts",
      "import": "./lib/plugins/array.js"
    }
  }
}
```

**You don't write this. The directory structure declares it.**

---

## Rule 4: Platform-Specific Handling

If you need different code for browser vs Node.js:

```
src/
├── index.node.ts              # Node.js version
├── index.browser.ts           # Browser version
└── core.ts                    # Shared code
```

Build script detects `.node.ts` and `.browser.ts` automatically and generates conditional exports.

**DO NOT write conditional exports in source package.json.**

---

## Rule 5: When You Find "Dirty" package.json

A **"dirty" package.json** has forbidden fields (Rule 1) in source code.

### What to do:

**1. Report it immediately:**
```
⚠️ DIRTY package.json found in @alaq/nucl

These BUILD-GENERATED fields should NOT be in source:
- "exports" (auto-generated from src/ structure)
- "license" (auto-generated)
- "author" (auto-generated)
- "repository" (auto-generated)
- "files" (auto-generated)
- "peerDependencies" (auto-generated)

Current: [show full content]

Expected: [show clean version]

Shall I clean this up?
```

**2. Show exact clean version:**
```json
{
  "name": "@alaq/nucl",
  "version": "6.0.0-alpha.1",
  "description": "Enhanced reactive primitive with plugin system",
  "type": "module",
  "scripts": {
    "build": "bun run ../../scripts/index.ts build",
    "test": "bun test",
    "dev": "bun test --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest",
    "@alaq/quark": "workspace:*"
  }
}
```

**3. Explain why:**
- Duplication violates single source of truth
- Manual updates when exports change → inconsistency
- Build system confusion
- Solution: Keep source clean, build script handles rest

---

## Rule 6: How Build Script Detects Exports

1. **Finds index.ts** (or .node.ts/.browser.ts)
   - Creates export "."
   - Auto-detects platform variants

2. **Scans subdirectories**
   - `src/presets/` → exports "./nucleus", "./fusion"
   - `src/plugins/` → exports "./plugins/array"
   - Any .ts file → potential export

3. **Creates type mappings**
   - Matches files in `types/` directory
   - Generates type references

4. **Builds exports map**
   - Complete "exports" field in built package.json
   - No manual editing needed

**You only need to:** Create directory structure and files. Build does the rest.

---

## Rule 7: Consistency Checks

When reviewing packages, REPORT these issues:

### Check 1: Dirty package.json
```
IF source package.json contains any forbidden field (Rule 1)
THEN report and propose cleanup
```

### Check 2: Structure Mismatch
```
IF exports specifies "./nucleus"
BUT no file "src/presets/nucleus.ts" exists
THEN report mismatch
```

### Check 3: Platform-Specific Mismatch
```
IF exports has conditional node/browser
BUT only index.ts exists (no .node.ts/.browser.ts)
THEN report inconsistency
```

### Check 4: Sibling Inconsistency
```
IF one package uses .node.ts/.browser.ts
BUT sibling packages use only index.ts
THEN check if inconsistency is intentional
```

---

## Rule 8: The Complete Checklist

### Source Checklist (packages/*/package.json)

```
REQUIRED:
[ ] name
[ ] version
[ ] description
[ ] type: "module"
[ ] scripts: build, test, dev
[ ] dependencies (can be empty)
[ ] devDependencies

FORBIDDEN (will be generated):
[ ] ❌ exports
[ ] ❌ license
[ ] ❌ author
[ ] ❌ repository
[ ] ❌ files
[ ] ❌ peerDependencies
[ ] ❌ main
[ ] ❌ types
```

### Directory Structure Checklist

```
[ ] src/index.ts exists (or .node.ts/.browser.ts)
[ ] src/presets/ exists (if you have presets)
[ ] src/plugins/ exists (if you have plugins)
[ ] Each file has .d.ts in types/
[ ] No barrel exports (no export * from)
```

### After Build Checklist (artifacts/)

```
[ ] "exports" map exists and is complete
[ ] "license": "MIT"
[ ] "author": "Alak Contributors"
[ ] "repository.directory" correct
[ ] "files": ["lib", "types", "README.md"]
[ ] "peerDependencies" lists all @alaq/* deps
```

---

## Rule 9: README Requirements

Every package needs `packages/*/README.md`

```markdown
# @alaq/package-name

Brief description.

## Installation

bun add @alaq/package-name

## Usage

### Default
import { Feature } from '@alaq/package-name'

### Preset
import { Feature } from '@alaq/package-name/nucleus'

## API

[Document all public exports]

## License

MIT
```

---

## Examples: Correct Source Packages

### Example 1: Minimal Package

**packages/quark/package.json:**
```json
{
  "name": "@alaq/quark",
  "version": "1.0.0",
  "description": "Hybrid reactive primitive",
  "type": "module",
  "scripts": {
    "build": "bun run ../../scripts/index.ts build",
    "test": "bun test",
    "dev": "bun test --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

**Source structure:**
```
src/
├── index.ts
└── bus.ts
```

**Generated exports (artifacts/):**
```json
{
  "exports": {
    ".": { "types": "./types/index.d.ts", "import": "./lib/index.js" },
    "./bus": { "types": "./types/bus.d.ts", "import": "./lib/bus.js" }
  }
}
```

### Example 2: Complex Package with Presets

**packages/nucl/package.json:**
```json
{
  "name": "@alaq/nucl",
  "version": "6.0.0-alpha.1",
  "description": "Enhanced reactive primitive",
  "type": "module",
  "scripts": {
    "build": "bun run ../../scripts/index.ts build",
    "test": "bun test",
    "dev": "bun test --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest",
    "@alaq/quark": "workspace:*"
  }
}
```

**Source structure:**
```
src/
├── index.ts
├── core.ts
├── presets/
│   ├── nucleus.ts
│   ├── fusion.ts
│   └── heavy.ts
└── plugins/
    ├── array.ts
    ├── universal.ts
    └── object.ts
```

**Generated exports (artifacts/):**
```json
{
  "exports": {
    ".": { "types": "./types/index.d.ts", "import": "./lib/index.js" },
    "./nucleus": { "types": "./types/presets/nucleus.d.ts", "import": "./lib/presets/nucleus.js" },
    "./fusion": { "types": "./types/presets/fusion.d.ts", "import": "./lib/presets/fusion.js" },
    "./heavy": { "types": "./types/presets/heavy.d.ts", "import": "./lib/presets/heavy.js" },
    "./plugins/array": { "types": "./types/plugins/array.d.ts", "import": "./lib/plugins/array.js" }
  }
}
```

### Example 3: Platform-Specific Package

**packages/rune/package.json:**
```json
{
  "name": "@alaq/rune",
  "version": "6.0.0-alpha.1",
  "description": "Platform utilities",
  "type": "module",
  "scripts": {
    "build": "bun run ../../scripts/index.ts build",
    "test": "bun test",
    "dev": "bun test --watch"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

**Source structure:**
```
src/
├── index.node.ts
├── index.browser.ts
├── core.ts
└── utils.ts
```

**Generated exports (artifacts/):**
```json
{
  "exports": {
    ".": {
      "types": "./types/index.d.ts",
      "node": "./lib/index.node.js",
      "browser": "./lib/index.browser.js",
      "import": "./lib/index.js"
    }
  }
}
```

---

## Summary: The Two-Stage Process

### Stage 1: You Create

```
packages/your-package/
├── src/
│   ├── index.ts (or .node.ts/.browser.ts)
│   ├── presets/
│   │   ├── nucleus.ts
│   │   └── heavy.ts
│   └── plugins/
│       └── array.ts
├── types/
│   └── index.d.ts
├── README.md
└── package.json  ← MINIMAL (no forbidden fields)
```

### Stage 2: Build Script Generates

```
artifacts/your-package/
├── lib/
│   ├── index.js
│   ├── presets/
│   │   ├── nucleus.js
│   │   └── heavy.js
│   └── plugins/
│       └── array.js
├── types/
│   └── (combined types)
├── README.md (copied)
└── package.json  ← COMPLETE WITH:
                     - exports (auto-detected!)
                     - license, author, repository
                     - keywords, files
                     - peerDependencies
```

**Result:** Published to npm with full metadata inferred from structure.

---

## Critical Rules (TL;DR)

1. **Forbidden fields in source** (Rule 1)
   - Never: exports, license, author, repository, files, peerDependencies, main, types
   - If found: report as dirty, propose cleanup

2. **Exports from directory structure**
   - src/index.ts → "."
   - src/presets/nucleus.ts → "./nucleus"
   - src/plugins/array.ts → "./plugins/array"
   - Build auto-generates exports map

3. **Platform-specific via filenames**
   - src/index.node.ts, src/index.browser.ts → auto-detected
   - Don't hardcode in source package.json

4. **When dirty package.json found**
   - Report immediately with list of forbidden fields
   - Show clean version
   - Ask before fixing
   - Explain single source of truth

5. **Build system handles the rest**
   - Reads src/ structure
   - Generates exports
   - Adds metadata
   - Ready to publish
