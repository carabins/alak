/**
 * Rolldown Builder - compiles TypeScript to ESM/CJS/UMD
 */

import { rolldown } from 'rolldown'
import * as path from 'path'
import * as fs from 'fs'
import type { DetectedEntry } from '../generators/PackageJsonGenerator'

export interface RolldownBuildOptions {
  sourceDir: string        // packages/quark
  artifactsDir: string     // artifacts/quark
  entryPoints: DetectedEntry[]
  packageName: string      // @alaq/quark
}

export class RolldownBuilder {
  constructor(private options: RolldownBuildOptions) {}

  /**
   * Build all entry points
   */
  async build(): Promise<boolean> {
    const { sourceDir, artifactsDir, entryPoints, packageName } = this.options
    const prefix = this.getPrefix()

    // Ensure output directories exist
    fs.mkdirSync(path.join(artifactsDir, 'lib'), { recursive: true })
    fs.mkdirSync(path.join(artifactsDir, 'legacy'), { recursive: true })

    try {
      // Build each entry point
      for (const entry of entryPoints) {
        await this.buildEntry(entry)
      }

      // Build UMD minified bundle
      await this.buildUmd()

      console.log(`${prefix} ✅ Rolldown complete`)
      return true
    } catch (error) {
      console.error(`${prefix} ❌ Rolldown failed:`, error)
      return false
    }
  }

  /**
   * Get logging prefix
   */
  private getPrefix(): string {
    const pkgShortName = this.options.packageName.split('/').pop()!
    return `[${pkgShortName}]`
  }

  /**
   * Build single entry point (ESM + CJS)
   */
  private async buildEntry(entry: DetectedEntry): Promise<void> {
    const { artifactsDir } = this.options

    if (entry.platformSpecific) {
      // Platform-specific builds
      await this.buildPlatformSpecific(entry, artifactsDir)
    } else {
      // Universal builds
      await this.buildUniversal(entry, artifactsDir)
    }
  }

  /**
   * Build universal entry (single source)
   */
  private async buildUniversal(entry: DetectedEntry, artifactsDir: string): Promise<void> {
    const inputPath = entry.path

    // ESM build (lib/)
    const esmOutput = path.join(artifactsDir, entry.outputs.esm)

    const esmBuild = await rolldown({
      input: inputPath,
      external: (id) => this.isExternal(id),
    })

    await esmBuild.write({
      format: 'es',
      file: esmOutput,
      exports: 'named',
    })

    // CJS build (legacy/)
    const cjsOutput = path.join(artifactsDir, entry.outputs.cjs)

    const cjsBuild = await rolldown({
      input: inputPath,
      external: (id) => this.isExternal(id),
    })

    await cjsBuild.write({
      format: 'cjs',
      file: cjsOutput,
      exports: 'named',
    })
  }

  /**
   * Build platform-specific entries (node + browser)
   */
  private async buildPlatformSpecific(entry: DetectedEntry, artifactsDir: string): Promise<void> {
    if (!entry.platformSpecific) return

    const baseName = entry.name === 'index' ? 'index' : entry.name

    // Node.js builds
    if (entry.platformSpecific.node) {
      const nodeInput = entry.platformSpecific.node

      // ESM (lib/)
      const nodeEsmOutput = path.join(artifactsDir, 'lib', `${baseName}.node.js`)
      const nodeEsmBuild = await rolldown({
        input: nodeInput,
        external: (id) => this.isExternal(id),
      })
      await nodeEsmBuild.write({
        format: 'es',
        file: nodeEsmOutput,
        exports: 'named',
      })

      // CJS (legacy/)
      const nodeCjsOutput = path.join(artifactsDir, 'legacy', `${baseName}.node.cjs`)
      const nodeCjsBuild = await rolldown({
        input: nodeInput,
        external: (id) => this.isExternal(id),
      })
      await nodeCjsBuild.write({
        format: 'cjs',
        file: nodeCjsOutput,
        exports: 'named',
      })
    }

    // Browser build (ESM in lib/, UMD will be separate)
    if (entry.platformSpecific.browser) {
      const browserInput = entry.platformSpecific.browser
      const browserOutput = path.join(artifactsDir, 'lib', `${baseName}.browser.js`)

      const browserBuild = await rolldown({
        input: browserInput,
        external: (id) => this.isExternal(id),
      })

      await browserBuild.write({
        format: 'es',
        file: browserOutput,
        exports: 'named',
      })
    }
  }

  /**
   * Build UMD minified bundle for CDN (root of artifacts/)
   */
  private async buildUmd(): Promise<void> {
    const { sourceDir, artifactsDir, packageName, entryPoints } = this.options

    // Find main entry
    const mainEntry = entryPoints.find(e => e.name === 'index')
    if (!mainEntry) return

    // Use browser version if available, otherwise universal
    const inputPath = mainEntry.platformSpecific?.browser || mainEntry.path

    // Package name for UMD global (e.g., @alaq/quark -> Quark)
    const globalName = packageName
      .split('/')
      .pop()!
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')

    // UMD goes to root of artifacts/
    const umdOutput = path.join(artifactsDir, `${packageName.split('/').pop()}.min.js`)

    const umdBuild = await rolldown({
      input: inputPath,
      external: (id) => this.isExternal(id),
    })

    await umdBuild.write({
      format: 'umd',
      file: umdOutput,
      name: globalName,
      exports: 'named',
      // Minify for production
      minify: true,
      // Globals for external dependencies
      globals: {
        '@alaq/quark': 'Quark',
        'vue': 'Vue',
      },
    })
  }

  /**
   * Check if module should be external
   */
  private isExternal(id: string): boolean {
    // External: node built-ins, npm packages, workspace packages
    return (
      // Node.js built-ins
      /^(node:)?[a-z_]+$/.test(id) ||
      // npm packages (@alaq/*, vue, etc.)
      /^[@a-z]/.test(id) ||
      // Absolute paths outside source
      (path.isAbsolute(id) && !id.startsWith(this.options.sourceDir))
    )
  }
}
