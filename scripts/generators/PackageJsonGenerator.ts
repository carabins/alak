// Package.json generator with auto-detection

import * as path from 'path'
import * as fs from 'fs'
import type { PackageJson } from 'type-fest'

export interface BuildOptions {
  umd?: {
    name: string        // Global name for UMD build
    minify: boolean     // Minify UMD build
  }
  sideEffects?: boolean | string[]
}

export interface GeneratorConfig {
  // Paths
  sourceDir: string           // packages/nucl
  artifactsDir: string        // artifacts/nucl

  // Source metadata
  sourcePackageJson: PackageJson
  rootPackageJson: PackageJson

  // Detected structure
  entryPoints: DetectedEntry[]
}

export interface DetectedEntry {
  name: string              // 'index', 'nucleus', 'fusion'
  path: string              // src/nucleus.ts
  exportPath: string        // '.' or './nucleus'
  outputs: {
    esm: string            // lib/nucleus.js
    cjs: string            // legacy/nucleus.cjs
    types: string          // types/nucleus.d.ts
  }
  // Platform-specific entries
  platformSpecific?: {
    node?: string          // src/index.node.ts
    browser?: string       // src/index.browser.ts
  }
}

export class PackageJsonGenerator {
  constructor(private config: GeneratorConfig) {}

  /**
   * Generate complete package.json for artifacts
   */
  generate(): PackageJson {
    const pkg: any = {}

    // 1. Copy metadata from source
    this.addMetadata(pkg)

    // 2. Copy common fields from root
    this.addCommonFields(pkg)

    // 3. Generate entry points
    this.addEntryPoints(pkg)

    // 4. Generate exports map
    this.addExports(pkg)

    // 5. Add files list
    this.addFiles(pkg)

    // 6. Scan and add dependencies
    this.addDependencies(pkg)

    // 7. Add fixed fields
    this.addFixedFields(pkg)

    // 8. Add UMD fields if configured
    this.addUmdFields(pkg)

    return pkg
  }

  /**
   * 1. Copy metadata from source package.json
   */
  private addMetadata(pkg: any): void {
    const src = this.config.sourcePackageJson

    if (src.name) pkg.name = src.name
    if (src.version) pkg.version = src.version
    if (src.description) pkg.description = src.description
    if (src.keywords) pkg.keywords = src.keywords
  }

  /**
   * 2. Copy common fields from root package.json
   */
  private addCommonFields(pkg: any): void {
    const root = this.config.rootPackageJson

    if (root.license) pkg.license = root.license
    if (root.repository) pkg.repository = root.repository
    if (root.author) pkg.author = root.author
    if (root.homepage) pkg.homepage = root.homepage
    if (root.bugs) pkg.bugs = root.bugs
  }

  /**
   * 3. Generate main entry points
   */
  private addEntryPoints(pkg: any): void {
    const mainEntry = this.config.entryPoints.find(e => e.name === 'index')

    if (mainEntry) {
      // All outputs go to dist/
      pkg.main = './' + mainEntry.outputs.cjs
      pkg.module = './' + mainEntry.outputs.esm
      pkg.types = './' + mainEntry.outputs.types
    }
  }

  /**
   * 4. Generate exports map
   */
  private addExports(pkg: any): void {
    pkg.exports = {}

    for (const entry of this.config.entryPoints) {
      const exportPath = entry.exportPath

      // Platform-specific exports (node + browser)
      if (entry.platformSpecific) {
        const baseName = entry.name === 'index' ? 'index' : entry.name

        pkg.exports[exportPath] = {
          types: './' + entry.outputs.types,
          node: {
            import: `./lib/${baseName}.node.js`,
            require: `./legacy/${baseName}.node.cjs`
          },
          browser: `./lib/${baseName}.browser.js`,
          default: `./lib/${baseName}.browser.js`
        }
      } else {
        // Universal exports (all in dist/)
        pkg.exports[exportPath] = {
          types: './' + entry.outputs.types,
          import: './' + entry.outputs.esm,
          require: './' + entry.outputs.cjs,
          default: './' + entry.outputs.esm
        }
      }
    }

    // Always add package.json export
    pkg.exports['./package.json'] = './package.json'
  }

  /**
   * 5. Generate files list for npm publish
   */
  private addFiles(pkg: any): void {
    const files: string[] = [
      'lib/',      // ESM modules
      'legacy/',   // CJS modules
      'types/',    // TypeScript declarations
      '*.min.js',  // UMD bundles in root
    ]

    pkg.files = files
  }

  /**
   * 6. Scan source code and auto-detect dependencies
   */
  private addDependencies(pkg: any): void {
    const detectedDeps = this.scanDependencies()

    // Merge with source package.json dependencies
    const sourceDeps = this.config.sourcePackageJson.dependencies || {}
    const allDeps = { ...detectedDeps, ...sourceDeps }

    if (Object.keys(allDeps).length > 0) {
      pkg.dependencies = {}
      for (const dep of Object.keys(allDeps)) {
        pkg.dependencies[dep] = 'latest'
      }
    }

    // Copy peer dependencies as-is
    if (this.config.sourcePackageJson.peerDependencies) {
      pkg.peerDependencies = this.config.sourcePackageJson.peerDependencies
    }
  }

  /**
   * Scan source files for imports
   */
  private scanDependencies(): Record<string, string> {
    const deps: Record<string, string> = {}
    const srcDir = path.join(this.config.sourceDir, 'src')

    if (!fs.existsSync(srcDir)) {
      return deps
    }

    const scanFile = (filePath: string) => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')

        // Match: from '@alaq/package' or from '@alaq/package/submodule'
        const importRegex = /from\s+['"](@alaq\/[a-z-]+)/g
        let match

        while ((match = importRegex.exec(content)) !== null) {
          const pkgName = match[1]
          // Skip self-imports
          if (pkgName !== this.config.sourcePackageJson.name) {
            deps[pkgName] = 'latest'
          }
        }

        // Also check for 'alak' imports
        if (/from\s+['"]alak['"/]/.test(content)) {
          deps['alak'] = 'latest'
        }

        // Check for 'vue' imports
        if (/from\s+['"]vue['"/]/.test(content)) {
          deps['vue'] = 'latest'
        }
      } catch (err) {
        // Ignore read errors
      }
    }

    // Walk src directory
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir)

      for (const file of files) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
          walk(fullPath)
        } else if (file.endsWith('.ts')) {
          scanFile(fullPath)
        }
      }
    }

    walk(srcDir)

    return deps
  }

  /**
   * 7. Add fixed fields
   */
  private addFixedFields(pkg: any): void {
    // Side effects (default false for tree-shaking)
    const buildOptions = (this.config.sourcePackageJson as any).buildOptions as BuildOptions | undefined
    pkg.sideEffects = buildOptions?.sideEffects ?? false

    // Publish config
    pkg.publishConfig = {
      access: 'public'
    }
  }

  /**
   * 8. Add UMD fields for browser CDN (always included)
   */
  private addUmdFields(pkg: any): void {
    const buildOptions = (this.config.sourcePackageJson as any).buildOptions as BuildOptions | undefined

    // Use explicit name or package name
    const umdName = buildOptions?.umd?.name || pkg.name.split('/').pop()
    const umdFile = `./${umdName}.min.js`

    pkg.unpkg = umdFile
    pkg.jsdelivr = umdFile
  }
}

/**
 * Detect all entry points from src/ directory
 *
 * IMPORTANT RULE: Only index.ts files create exports
 * - src/index.ts → "."
 * - src/fusion/index.ts → "./fusion"
 * - src/nucleus/index.ts → "./nucleus"
 */
export function detectEntryPoints(sourceDir: string): DetectedEntry[] {
  const entries: DetectedEntry[] = []
  const srcDir = path.join(sourceDir, 'src')

  if (!fs.existsSync(srcDir)) {
    return entries
  }

  // Check for main entry
  const indexPath = path.join(srcDir, 'index.ts')
  const indexNodePath = path.join(srcDir, 'index.node.ts')
  const indexBrowserPath = path.join(srcDir, 'index.browser.ts')

  // Platform-specific entry points
  if (fs.existsSync(indexNodePath) && fs.existsSync(indexBrowserPath)) {
    entries.push({
      name: 'index',
      path: indexNodePath, // reference to node version
      exportPath: '.',
      outputs: {
        esm: 'lib/index.node.js',
        cjs: 'legacy/index.node.cjs',
        types: 'types/index.d.ts'
      },
      platformSpecific: {
        node: indexNodePath,
        browser: indexBrowserPath
      }
    })
  } else if (fs.existsSync(indexPath)) {
    // Universal entry point
    entries.push({
      name: 'index',
      path: indexPath,
      exportPath: '.',
      outputs: {
        esm: 'lib/index.js',
        cjs: 'legacy/index.cjs',
        types: 'types/index.d.ts'
      }
    })
  }

  // Scan for submodules with index.ts
  const scanDirectory = (dir: string, prefix: string = '') => {
    const files = fs.readdirSync(dir)

    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        const subIndexPath = path.join(fullPath, 'index.ts')
        const moduleName = prefix ? `${prefix}/${file}` : file

        if (fs.existsSync(subIndexPath)) {
          entries.push({
            name: moduleName,
            path: subIndexPath,
            exportPath: `./${moduleName}`,
            outputs: {
              esm: `lib/${moduleName}.js`,
              cjs: `legacy/${moduleName}.cjs`,
              types: `types/${moduleName}.d.ts`
            }
          })
        }

        // Recursively scan nested directories
        scanDirectory(fullPath, moduleName)
      }
    }
  }

  scanDirectory(srcDir)

  return entries
}

/**
 * Helper: Read root package.json
 */
export function readRootPackageJson(): PackageJson {
  const rootPath = path.join(process.cwd(), 'package.json')
  return JSON.parse(fs.readFileSync(rootPath, 'utf-8'))
}

/**
 * Helper: Check if file should be excluded
 */
function isTestFile(filename: string): boolean {
  const excludePatterns = [
    '.test.',
    '.spec.',
    '.bench.',
    '.backup.',
    '.tmp.',
    '.old.',
    'test-',
    'playground',
    'example'
  ]

  return excludePatterns.some(pattern => filename.includes(pattern))
}
