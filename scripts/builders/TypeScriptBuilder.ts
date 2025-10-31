/**
 * TypeScript Builder - generates .d.ts declarations
 */

import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import type { DetectedEntry } from '../generators/PackageJsonGenerator'

export interface TypeScriptBuildOptions {
  sourceDir: string        // packages/quark
  artifactsDir: string     // artifacts/quark
  entryPoints: DetectedEntry[]
  packageName: string      // @alaq/quark
}

export class TypeScriptBuilder {
  constructor(private options: TypeScriptBuildOptions) {}

  /**
   * Generate TypeScript declarations
   */
  async build(): Promise<boolean> {
    const { sourceDir, artifactsDir, packageName } = this.options
    const prefix = this.getPrefix()

    const typesDir = path.join(artifactsDir, 'types')
    fs.mkdirSync(typesDir, { recursive: true })

    try {
      // Run tsc to generate declarations
      const buildTsconfig = await this.createTempTsConfig(sourceDir)

      try {
        execSync(
          `bunx --bun tsc --project ${buildTsconfig} --outDir ${typesDir} --declaration --emitDeclarationOnly`,
          {
            cwd: process.cwd(),
            stdio: 'pipe', // Suppress output
          }
        )
      } catch (error) {
        // tsc might exit with error code but still generate files
        // Check if declarations were generated
        const hasDeclarations = fs.existsSync(path.join(typesDir, 'index.d.ts'))
        if (!hasDeclarations) {
          throw error
        }
      }

      console.log(`${prefix} ✅ TypeScript complete`)
      return true
    } catch (error) {
      console.error(`${prefix} ❌ TypeScript failed:`, error)
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
   * Create temporary tsconfig.json for building
   */
  private async createTempTsConfig(sourceDir: string): Promise<void> {
    const tsconfigPath = path.join(sourceDir, 'tsconfig.build.json')

    const config = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020', 'DOM'], // Include DOM for browser code
        declaration: true,
        declarationMap: false,
        sourceMap: false,
        rootDir: './src',
        strict: false, // Allow any types for faster build
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'bundler',
      },
      include: ['src/**/*.ts'],
      exclude: ['node_modules', 'dist', 'test', '**/*.test.ts', '**/*.spec.ts', '**/*.bench.ts'],
    }

    fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2))
    return tsconfigPath
  }
}
