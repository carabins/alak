import * as path from 'path'
import * as fs from 'fs'
import type { PackageJson } from 'type-fest'

export interface BuildOptions {
  umd?: { name: string; minify: boolean }
  sideEffects?: boolean | string[]
}

export interface GeneratorConfig {
  sourceDir: string
  artifactsDir: string
  sourcePackageJson: PackageJson
  rootPackageJson: PackageJson
  entryPoints: DetectedEntry[]
}

export interface DetectedEntry {
  name: string
  path: string
  exportPath: string
  outputs: { esm: string; cjs: string; types: string }
  platformSpecific?: { node?: string; browser?: string }
}

export class PackageJsonGenerator {
  constructor(private config: GeneratorConfig) {}

  generate(): PackageJson {
    const pkg: any = {}
    const { sourcePackageJson: src, rootPackageJson: root } = this.config

    // Copy metadata
    const metaFields = ['name', 'version', 'description', 'keywords'] as const
    metaFields.forEach(f => { if (src[f]) pkg[f] = src[f] })

    // Copy root fields
    const rootFields = ['license', 'repository', 'author', 'homepage', 'bugs'] as const
    rootFields.forEach(f => { if (root[f]) pkg[f] = root[f] })

    // Entry points
    const mainEntry = this.config.entryPoints.find(e => e.name === 'index')
    if (mainEntry) {
      pkg.main = './' + mainEntry.outputs.cjs
      pkg.module = './' + mainEntry.outputs.esm
      pkg.types = './' + mainEntry.outputs.types
    }

    // Exports, files, deps, fixed fields
    this.addExports(pkg)
    this.addFiles(pkg)
    this.addDependencies(pkg)
    this.addFixedFields(pkg)
    this.addUmdFields(pkg)

    return pkg
  }

  private addExports(pkg: any): void {
    pkg.exports = {}

    for (const entry of this.config.entryPoints) {
      const base = entry.name === 'index' ? 'index' : entry.name

      pkg.exports[entry.exportPath] = entry.platformSpecific
        ? {
            types: './' + entry.outputs.types,
            node: {
              import: `./lib/${base}.node.js`,
              require: `./legacy/${base}.node.cjs`
            },
            browser: `./lib/${base}.browser.js`,
            default: `./lib/${base}.browser.js`
          }
        : {
            types: './' + entry.outputs.types,
            import: './' + entry.outputs.esm,
            require: './' + entry.outputs.cjs,
            default: './' + entry.outputs.esm
          }
    }

    pkg.exports['./package.json'] = './package.json'
  }

  private addFiles(pkg: any): void {
    pkg.files = ['lib/', 'legacy/', 'types/', '*.min.js']
  }

  private addDependencies(pkg: any): void {
    const detected = this.scanDependencies()
    const source = this.config.sourcePackageJson.dependencies || {}
    const all = { ...detected, ...source }

    if (Object.keys(all).length > 0) {
      pkg.dependencies = Object.fromEntries(Object.keys(all).map(d => [d, 'latest']))
    }

    if (this.config.sourcePackageJson.peerDependencies) {
      pkg.peerDependencies = this.config.sourcePackageJson.peerDependencies
    }
  }

  private scanDependencies(): Record<string, string> {
    const deps: Record<string, string> = {}
    const srcDir = path.join(this.config.sourceDir, 'src')
    if (!fs.existsSync(srcDir)) return deps

    const scanFile = (filePath: string) => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const selfName = this.config.sourcePackageJson.name

        // Match @alaq/* imports
        const matches = content.matchAll(/from\s+['"](@alaq\/[a-z-]+)/g)
        for (const match of matches) {
          if (match[1] !== selfName) deps[match[1]] = 'latest'
        }

        // Check for alak/vue imports
        if (/from\s+['"]alak['"/]/.test(content)) deps['alak'] = 'latest'
        if (/from\s+['"]vue['"/]/.test(content)) deps['vue'] = 'latest'
      } catch {}
    }

    const walk = (dir: string) => {
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file)
        const stat = fs.statSync(fullPath)
        stat.isDirectory() ? walk(fullPath) : file.endsWith('.ts') && scanFile(fullPath)
      }
    }

    walk(srcDir)
    return deps
  }

  private addFixedFields(pkg: any): void {
    const opts = (this.config.sourcePackageJson as any).buildOptions as BuildOptions | undefined
    pkg.sideEffects = opts?.sideEffects ?? false
    pkg.publishConfig = { access: 'public' }
  }

  private addUmdFields(pkg: any): void {
    const opts = (this.config.sourcePackageJson as any).buildOptions as BuildOptions | undefined
    const name = opts?.umd?.name || pkg.name.split('/').pop()
    pkg.unpkg = pkg.jsdelivr = `./${name}.min.js`
  }
}

export function detectEntryPoints(sourceDir: string): DetectedEntry[] {
  const entries: DetectedEntry[] = []
  const srcDir = path.join(sourceDir, 'src')
  if (!fs.existsSync(srcDir)) return entries

  const createEntry = (name: string, indexPath: string, platformSpecific?: DetectedEntry['platformSpecific']): DetectedEntry => ({
    name,
    path: indexPath,
    exportPath: name === 'index' ? '.' : `./${name}`,
    outputs: {
      esm: `lib/${name}.js`,
      cjs: `legacy/${name}.cjs`,
      types: `types/${name}.d.ts`
    },
    platformSpecific
  })

  // Main entry
  const indexPath = path.join(srcDir, 'index.ts')
  const indexNodePath = path.join(srcDir, 'index.node.ts')
  const indexBrowserPath = path.join(srcDir, 'index.browser.ts')

  if (fs.existsSync(indexNodePath) && fs.existsSync(indexBrowserPath)) {
    entries.push({
      ...createEntry('index', indexNodePath),
      platformSpecific: { node: indexNodePath, browser: indexBrowserPath },
      outputs: { esm: 'lib/index.node.js', cjs: 'legacy/index.node.cjs', types: 'types/index.d.ts' }
    })
  } else if (fs.existsSync(indexPath)) {
    entries.push(createEntry('index', indexPath))
  }

  // Scan submodules
  const scan = (dir: string, prefix = '') => {
    for (const file of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, file)
      if (!fs.statSync(fullPath).isDirectory()) continue

      const subIndexPath = path.join(fullPath, 'index.ts')
      const moduleName = prefix ? `${prefix}/${file}` : file

      if (fs.existsSync(subIndexPath)) {
        entries.push(createEntry(moduleName, subIndexPath))
      }

      scan(fullPath, moduleName)
    }
  }

  scan(srcDir)
  return entries
}

export function readRootPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'))
}
