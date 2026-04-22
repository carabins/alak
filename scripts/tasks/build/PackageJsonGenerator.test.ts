import { describe, expect, test } from 'bun:test'
import type { PackageJson } from 'type-fest'
import {
  PackageJsonGenerator,
  type DetectedEntry,
  type GeneratorConfig,
} from './PackageJsonGenerator'

const indexEntry: DetectedEntry = {
  name: 'index',
  path: '/pkg/src/index.ts',
  exportPath: '.',
  outputs: { esm: 'lib/index.js', cjs: 'legacy/index.cjs', types: 'types/index.d.ts' },
}

const binEntry: DetectedEntry = {
  name: 'bin',
  path: '/pkg/src/bin.ts',
  exportPath: './bin',
  outputs: { esm: 'lib/bin.js', cjs: 'legacy/bin.cjs', types: 'types/bin.d.ts' },
}

const cliEntry: DetectedEntry = {
  name: 'cli',
  path: '/pkg/src/cli.ts',
  exportPath: './cli',
  outputs: { esm: 'lib/cli.js', cjs: 'legacy/cli.cjs', types: 'types/cli.d.ts' },
}

function makeConfig(src: PackageJson, entries: DetectedEntry[]): GeneratorConfig {
  return {
    sourceDir: '/pkg',
    artifactsDir: '/art',
    sourcePackageJson: src,
    rootPackageJson: { name: 'root', version: '1.0.0' },
    entryPoints: entries,
  }
}

describe('PackageJsonGenerator: bin field', () => {
  test('emits bin with ESM-rewritten paths for declared commands', () => {
    const src: PackageJson = {
      name: '@alaq/mcp',
      version: '6.0.0-alpha.0',
      bin: {
        'alaq-mcp': './src/bin.ts',
        'alaq-mcp-call': './src/cli.ts',
      } as any,
    }
    const gen = new PackageJsonGenerator(makeConfig(src, [indexEntry, binEntry, cliEntry]))
    const out = gen.generate() as any
    expect(out.bin).toEqual({
      'alaq-mcp': './lib/bin.js',
      'alaq-mcp-call': './lib/cli.js',
    })
  })

  test('omits bin field entirely when source has no bin', () => {
    const src: PackageJson = { name: '@alaq/atom', version: '6.0.0-alpha.0' }
    const gen = new PackageJsonGenerator(makeConfig(src, [indexEntry]))
    const out = gen.generate() as any
    expect(out.bin).toBeUndefined()
    expect('bin' in out).toBe(false)
  })

  test('omits bin when declared commands point to unbundled sources', () => {
    // graph-style: ./bin/aqc.ts lives outside src/, never matches an entry.
    const src: PackageJson = {
      name: '@alaq/graph',
      version: '6.0.0-alpha.0',
      bin: { aqc: './bin/aqc.ts' } as any,
    }
    const gen = new PackageJsonGenerator(makeConfig(src, [indexEntry]))
    const out = gen.generate() as any
    expect(out.bin).toBeUndefined()
  })

  test('partial: keeps matched entries, drops unmatched', () => {
    const src: PackageJson = {
      name: '@alaq/mixed',
      version: '6.0.0-alpha.0',
      bin: {
        good: './src/bin.ts',
        missing: './bin/elsewhere.ts',
      } as any,
    }
    const gen = new PackageJsonGenerator(makeConfig(src, [indexEntry, binEntry]))
    const out = gen.generate() as any
    expect(out.bin).toEqual({ good: './lib/bin.js' })
  })
})
