/**
 * Rolldown Builder - compiles TypeScript to ESM/CJS/UMD
 */

import { rolldown } from 'rolldown'
import * as path from 'path'
import * as fs from 'fs'
import type { DetectedEntry } from '../common/generators/PackageJsonGenerator'

export interface RolldownBuildOptions {
  sourceDir: string
  artifactsDir: string
  entryPoints: DetectedEntry[]
  packageName: string
}

const OPTIMIZE_CONFIG = { minify: { mangle: false } } as const

export class RolldownBuilder {
  constructor(private options: RolldownBuildOptions) {}

  private get prefix() {
    return `[${this.options.packageName.split('/').pop()!}]`
  }

  async build(): Promise<boolean> {
    const { artifactsDir, entryPoints } = this.options

    fs.mkdirSync(path.join(artifactsDir, 'lib'), { recursive: true })
    fs.mkdirSync(path.join(artifactsDir, 'legacy'), { recursive: true })

    try {
      for (const entry of entryPoints) {
        entry.platformSpecific
          ? await this.buildPlatformSpecific(entry)
          : await this.buildUniversal(entry)
      }

      await this.buildUmd()

      console.log(`${this.prefix} ✅ Rolldown complete`)
      return true
    } catch (error) {
      console.error(`${this.prefix} ❌ Rolldown failed:`, error)
      return false
    }
  }

  private async buildUniversal(entry: DetectedEntry): Promise<void> {
    const bundle = await rolldown({
      input: entry.path,
      external: (id) => this.isExternal(id),
    })

    const outputs = [
      { format: 'es' as const, file: entry.outputs.esm },
      { format: 'cjs' as const, file: entry.outputs.cjs },
    ]

    for (const { format, file } of outputs) {
      await bundle.write({
        format,
        file: path.join(this.options.artifactsDir, file),
        exports: 'named',
        ...OPTIMIZE_CONFIG,
      })
    }
  }

  private async buildPlatformSpecific(entry: DetectedEntry): Promise<void> {
    if (!entry.platformSpecific) return

    const { artifactsDir } = this.options
    const base = entry.name === 'index' ? 'index' : entry.name

    if (entry.platformSpecific.node) {
      await this.buildForPlatform(entry.platformSpecific.node, [
        { format: 'es', file: path.join(artifactsDir, 'lib', `${base}.node.js`) },
        { format: 'cjs', file: path.join(artifactsDir, 'legacy', `${base}.node.cjs`) },
      ])
    }

    if (entry.platformSpecific.browser) {
      await this.buildForPlatform(entry.platformSpecific.browser, [
        { format: 'es', file: path.join(artifactsDir, 'lib', `${base}.browser.js`) },
      ])
    }
  }

  private async buildForPlatform(input: string, outputs: Array<{ format: 'es' | 'cjs'; file: string }>) {
    const bundle = await rolldown({
      input,
      external: (id) => this.isExternal(id),
    })

    for (const { format, file } of outputs) {
      await bundle.write({ format, file, exports: 'named', ...OPTIMIZE_CONFIG })
    }
  }

  private async buildUmd(): Promise<void> {
    const { artifactsDir, packageName, entryPoints } = this.options
    const mainEntry = entryPoints.find(e => e.name === 'index')
    if (!mainEntry) return

    const input = mainEntry.platformSpecific?.browser || mainEntry.path
    const pkgShort = packageName.split('/').pop()!
    const globalName = pkgShort
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')

    const bundle = await rolldown({
      input,
      external: (id) => this.isExternal(id),
    })

    await bundle.write({
      format: 'umd',
      file: path.join(artifactsDir, `${pkgShort}.min.js`),
      name: globalName,
      exports: 'named',
      minify: true,
      globals: { '@alaq/quark': 'Quark', 'vue': 'Vue' },
    })
  }

  private isExternal(id: string): boolean {
    return (
      /^(node:)?[a-z_]+$/.test(id) ||
      /^[@a-z]/.test(id) ||
      (path.isAbsolute(id) && !id.startsWith(this.options.sourceDir))
    )
  }
}
