// Unified Rolldown configuration for monorepo packages
// Automatically creates config based on package structure and package.json

import type { RolldownPlugin, RolldownOptions } from 'rolldown'
import * as path from 'path'
import * as fs from 'fs-extra'
import type { PackageJson } from 'type-fest'

export interface UnifiedBuildContext {
  packageDir: string
  packageName: string
  packageJson: PackageJson
  artifactsDir: string
}

// Plugin for processing types/ folder
// Combines all .d.ts files from types/ into a single types.d.ts
export function typesPlugin(ctx: UnifiedBuildContext): RolldownPlugin {
  let processed = false

  return {
    name: 'alak-types-plugin',

    async generateBundle(outputOptions, bundle) {
      // Run only once per package (not for each output format)
      if (processed) return
      processed = true

      const typesDir = path.join(ctx.packageDir, 'types')

      if (!fs.existsSync(typesDir)) {
        return
      }

      console.log(`[types] Processing ${ctx.packageName}`)

      // 1. Read all .d.ts files and combine them
      const typeFiles = fs.readdirSync(typesDir).filter(f => f.endsWith('.d.ts'))
      let combinedTypes = ''

      typeFiles.forEach(file => {
        const sourcePath = path.join(typesDir, file)
        const content = fs.readFileSync(sourcePath)
        combinedTypes += content
      })

      // 2. Add references to @alaq/* dependencies
      const deps = {
        ...ctx.packageJson.dependencies,
        ...ctx.packageJson.peerDependencies,
      }

      const refs = Object.keys(deps || {})
        .filter(dep => dep.startsWith('@alaq/'))
        .map(dep => {
          const depName = dep.replace('@alaq/', '')
          return `/// <reference path="../${depName}/types.d.ts" />`
        })

      if (refs.length > 0) {
        combinedTypes = refs.join('\n') + '\n\n' + combinedTypes
      }

      // 3. Create types.d.ts in artifacts root
      const typesDtsPath = path.join(ctx.artifactsDir, 'types.d.ts')
      fs.writeFileSync(typesDtsPath, combinedTypes)
      console.log(`[types] Created types.d.ts (${typeFiles.length} files combined)`)

      // 4. Add reference in index.d.ts
      const indexDtsPath = path.join(ctx.artifactsDir, 'index.d.ts')
      if (fs.existsSync(indexDtsPath)) {
        let indexContent = fs.readFileSync(indexDtsPath, 'utf-8')

        if (!indexContent.includes('reference path="types.d.ts"')) {
          indexContent = `/// <reference path="types.d.ts" />\n${indexContent}`
          fs.writeFileSync(indexDtsPath, indexContent)
        }
      }
    }
  }
}

// Plugin for copying LICENSE file
export function licensePlugin(ctx: UnifiedBuildContext): RolldownPlugin {
  let processed = false

  return {
    name: 'alak-license-plugin',

    async generateBundle(outputOptions) {
      // Run only once per package
      if (processed) return
      processed = true

      const licensePath = path.join(process.cwd(), 'LICENSE')

      if (fs.existsSync(licensePath)) {
        fs.copyFileSync(licensePath, path.join(ctx.artifactsDir, 'LICENSE'))
      }
    }
  }
}

// Plugin for generating package.json with correct paths
export function packageJsonPlugin(
  ctx: UnifiedBuildContext,
  entryType: 'universal' | 'platform-specific',
  submodules: Array<{ name: string; path: string }> = []
): RolldownPlugin {
  let processed = false

  return {
    name: 'alak-package-json-plugin',

    async generateBundle(outputOptions) {
      // Run only once per package
      if (processed) return
      processed = true

      const sourcePkg = ctx.packageJson
      const pkg: any = {}

      // Core package info (always preserve from source)
      if (sourcePkg.name) pkg.name = sourcePkg.name
      if (sourcePkg.version) pkg.version = sourcePkg.version
      if (sourcePkg.description) pkg.description = sourcePkg.description
      if (sourcePkg.keywords) pkg.keywords = sourcePkg.keywords
      if (sourcePkg.author) pkg.author = sourcePkg.author
      if (sourcePkg.license) pkg.license = sourcePkg.license
      if (sourcePkg.repository) pkg.repository = sourcePkg.repository
      if (sourcePkg.homepage) pkg.homepage = sourcePkg.homepage
      if (sourcePkg.bugs) pkg.bugs = sourcePkg.bugs

      // Entry points configuration
      if (entryType === 'universal') {
        // Universal package (works in both Node.js and Browser)
        pkg.main = './index.js'
        pkg.module = './index.mjs'
        pkg.types = './index.d.ts'

        pkg.exports = {
          '.': {
            types: './index.d.ts',
            import: './index.mjs',
            require: './index.js',
            default: './index.mjs'
          },
          './package.json': './package.json'
        }

        // Add submodule exports
        submodules.forEach(submodule => {
          pkg.exports[`./${submodule.name}`] = {
            types: `./${submodule.name}.d.ts`,
            import: `./${submodule.name}.mjs`,
            require: `./${submodule.name}.js`,
            default: `./${submodule.name}.mjs`
          }
        })

        // Add browser field if UMD build exists
        const buildOptions = (sourcePkg as any).buildOptions
        if (buildOptions?.name) {
          pkg.browser = `./dist/${buildOptions.name}.global.js`
          pkg.unpkg = `./dist/${buildOptions.name}.global.js`
          pkg.jsdelivr = `./dist/${buildOptions.name}.global.js`
        }
      } else {
        // Platform-specific package
        pkg.main = './index.js'
        pkg.module = './index.mjs'
        pkg.types = './index.d.ts'

        pkg.exports = {
          '.': {
            types: './index.d.ts',
            node: {
              import: './index.mjs',
              require: './index.js',
              default: './index.mjs'
            },
            browser: {
              import: './index.browser.mjs',
              require: './index.browser.js',
              default: './index.browser.mjs'
            },
            default: {
              import: './index.mjs',
              require: './index.js'
            }
          },
          './package.json': './package.json'
        }

        // Add submodule exports (universal - same for browser and node)
        submodules.forEach(submodule => {
          pkg.exports[`./${submodule.name}`] = {
            types: `./${submodule.name}.d.ts`,
            import: `./${submodule.name}.mjs`,
            require: `./${submodule.name}.js`,
            default: `./${submodule.name}.mjs`
          }
        })

        // Browser field points to browser-specific build
        pkg.browser = './index.browser.js'

        // UMD build (browser only)
        const buildOptions = (sourcePkg as any).buildOptions
        if (buildOptions?.name) {
          pkg.unpkg = `./dist/${buildOptions.name}.global.js`
          pkg.jsdelivr = `./dist/${buildOptions.name}.global.js`
        }
      }

      // Files to include in npm package
      const files = ['*.js', '*.mjs', '*.d.ts', 'types.d.ts']

      // Add submodule files
      submodules.forEach(submodule => {
        files.push(`${submodule.name}.js`)
        files.push(`${submodule.name}.mjs`)
        files.push(`${submodule.name}.d.ts`)
      })

      if (fs.existsSync(path.join(ctx.artifactsDir, 'dist'))) {
        files.push('dist/')
      }
      pkg.files = files

      // Dependencies - scan source code to auto-detect monorepo dependencies
      // Automatically detects imports from @alaq/* packages and 'alak' package
      // Uses package version from source package.json with ^ prefix (e.g., ^5.0.0)
      // Source package.json dependencies take priority over auto-detected ones
      const detectedDeps: Record<string, string> = {}

      // Scan source files for imports
      const srcDir = path.join(ctx.packageDir, 'src')
      if (fs.existsSync(srcDir)) {
        const scanForImports = (dir: string) => {
          const files = fs.readdirSync(dir)
          files.forEach(file => {
            const fullPath = path.join(dir, file)
            const stat = fs.statSync(fullPath)
            if (stat.isDirectory()) {
              scanForImports(fullPath)
            } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
              const content = fs.readFileSync(fullPath, 'utf-8')
              // Match import statements from @alaq/* packages
              const importRegex = /from\s+['"](@alaq\/[^'"]+)['"]/g
              let match
              while ((match = importRegex.exec(content)) !== null) {
                const depName = match[1].split('/')[0] + '/' + match[1].split('/')[1] // Get @alaq/package
                if (depName !== sourcePkg.name) {
                  detectedDeps[depName] = '^' + (sourcePkg.version || '0.0.0')
                }
              }
              // Match import for 'alak' package
              const alakRegex = /from\s+['"]alak[\/'"]/g
              if (alakRegex.test(content) && sourcePkg.name !== 'alak') {
                detectedDeps['alak'] = '^' + (sourcePkg.version || '0.0.0')
              }
            }
          })
        }
        scanForImports(srcDir)
      }

      // Merge with source package.json dependencies (source takes priority)
      const allDeps = { ...detectedDeps, ...(sourcePkg.dependencies || {}) }
      pkg.dependencies = {}
      if (Object.keys(allDeps).length > 0) {
        for (const key in allDeps) {
          pkg.dependencies[key] = "latest"
        }

      }

      if (sourcePkg.peerDependencies && Object.keys(sourcePkg.peerDependencies).length > 0) {
        pkg.peerDependencies = sourcePkg.peerDependencies
      }
      if (sourcePkg.optionalDependencies && Object.keys(sourcePkg.optionalDependencies).length > 0) {
        pkg.optionalDependencies = sourcePkg.optionalDependencies
      }

      // Side effects configuration (default to false for better tree-shaking)
      // Can be overridden in source package.json
      if ('sideEffects' in sourcePkg) {
        pkg.sideEffects = sourcePkg.sideEffects
      } else {
        pkg.sideEffects = false
      }

      // Publish configuration
      pkg.publishConfig = {
        access: 'public'
      }

      // TypeScript configuration hints
      pkg.typings = './index.d.ts'

      // Write updated package.json to artifacts
      const pkgPath = path.join(ctx.artifactsDir, 'package.json')
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

      console.log(`[package.json] Created with ${entryType} exports configuration`)
    }
  }
}

// Get external dependencies from package.json
function getExternalDependencies(ctx: UnifiedBuildContext): string[] {
  return [
    ...Object.keys(ctx.packageJson.dependencies || {}),
    ...Object.keys(ctx.packageJson.peerDependencies || {}),
    'vue', // Vue always external
  ]
}

// Detect all exportable modules in src/ directory
// Returns: { main: ..., submodules: [...] }
function detectEntryPoints(ctx: UnifiedBuildContext) {
  const srcDir = path.join(ctx.packageDir, 'src')

  const nodeEntry = path.join(srcDir, 'index.node.ts')
  const browserEntry = path.join(srcDir, 'index.browser.ts')
  const universalEntry = path.join(srcDir, 'index.ts')

  // Detect submodules - all .ts files in src/ except index variants
  const submodules: Array<{ name: string; path: string }> = []
  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir)
    files.forEach(file => {
      if (
        file.endsWith('.ts') &&
        !file.endsWith('.d.ts') &&
        file !== 'index.ts' &&
        file !== 'index.node.ts' &&
        file !== 'index.browser.ts'
      ) {
        const name = file.replace(/\.ts$/, '')
        submodules.push({
          name,
          path: path.join(srcDir, file),
        })
      }
    })
  }

  if (fs.existsSync(nodeEntry) && fs.existsSync(browserEntry)) {
    return {
      type: 'platform-specific' as const,
      node: nodeEntry,
      browser: browserEntry,
      submodules,
    }
  }

  return {
    type: 'universal' as const,
    entry: universalEntry,
    submodules,
  }
}

// Create config for universal package (works everywhere)
function createUniversalConfig(
  ctx: UnifiedBuildContext,
  entry: string,
  submodules: Array<{ name: string; path: string }> = []
): RolldownOptions[] {
  const external = getExternalDependencies(ctx)
  const configs: RolldownOptions[] = []

  const basePlugins = [
    typesPlugin(ctx),
    licensePlugin(ctx),
    packageJsonPlugin(ctx, 'universal', submodules),
  ]

  // Resolve aliases for internal package imports
  const packageName = ctx.packageJson.name?.replace('@alaq/', '') || path.basename(ctx.packageDir)
  const resolve = {
    alias: {
      [packageName]: path.join(ctx.packageDir, 'src'),
      '@alaq/nucleus': path.join(process.cwd(), 'packages/nucleus/src'),
      '@alaq/atom': path.join(process.cwd(), 'packages/atom/src'),
      'alak': path.join(process.cwd(), 'packages/alak/src'),
    }
  }

  // Main entry - ESM build
  configs.push({
    input: entry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.mjs'),
      format: 'esm',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: basePlugins,
    resolve,
  })

  // Main entry - CommonJS build
  configs.push({
    input: entry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.js'),
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: basePlugins,
    resolve,
  })

  // Submodule builds - create separate entry points for each submodule
  submodules.forEach(submodule => {
    // ESM build for submodule
    configs.push({
      input: submodule.path,
      output: {
        file: path.join(ctx.artifactsDir, `${submodule.name}.mjs`),
        format: 'esm',
        sourcemap: true,
        exports: 'named',
      },
      external,
      plugins: [], // No plugins for submodules to avoid duplicate runs
      resolve,
    })

    // CommonJS build for submodule
    configs.push({
      input: submodule.path,
      output: {
        file: path.join(ctx.artifactsDir, `${submodule.name}.js`),
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      external,
      plugins: [],
      resolve,
    })
  })

  // UMD build (если указан globalName в buildOptions)
  const buildOptions = (ctx.packageJson as any).buildOptions
  if (buildOptions?.name) {
    const globalName = buildOptions.name.charAt(0).toUpperCase() + buildOptions.name.slice(1)

    configs.push({
      input: entry,
      output: {
        file: path.join(ctx.artifactsDir, 'dist', `${buildOptions.name}.global.js`),
        format: 'umd',
        name: globalName,
        sourcemap: true,
        exports: 'named',
        globals: {
          '@alaq/nucleus': 'Nucleus',
          '@alaq/atom': 'Atom',
          'alak': 'Alak',
          'vue': 'Vue',
        }
      },
      external: [], // UMD включает все зависимости
      plugins: basePlugins,
      resolve,
    })
  }

  return configs
}

/**
 * Создает конфигурацию для платформо-специфичного пакета
 *
 * Генерирует отдельные сборки для Node.js и Browser:
 * - index.mjs / index.js - Node.js версия (с require('crypto'), Buffer, etc)
 * - index.browser.mjs / index.browser.js - Browser версия (с Web APIs)
 * - package.json exports определяет какой файл использовать
 */
function createPlatformSpecificConfig(
  ctx: UnifiedBuildContext,
  nodeEntry: string,
  browserEntry: string,
  submodules: Array<{ name: string; path: string }> = []
): RolldownOptions[] {
  const external = getExternalDependencies(ctx)
  const configs: RolldownOptions[] = []

  const basePlugins = [
    typesPlugin(ctx),
    licensePlugin(ctx),
    packageJsonPlugin(ctx, 'platform-specific', submodules),
  ]

  // Resolve aliases for internal package imports
  const packageName = ctx.packageJson.name?.replace('@alaq/', '') || path.basename(ctx.packageDir)
  const resolve = {
    alias: {
      [packageName]: path.join(ctx.packageDir, 'src'),
      '@alaq/nucleus': path.join(process.cwd(), 'packages/nucleus/src'),
      '@alaq/atom': path.join(process.cwd(), 'packages/atom/src'),
      'alak': path.join(process.cwd(), 'packages/alak/src'),
    }
  }

  // Node.js builds (с доступом к Node.js APIs)
  configs.push({
    input: nodeEntry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.mjs'),
      format: 'esm',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: basePlugins,
    platform: 'node',
    resolve,
  })

  configs.push({
    input: nodeEntry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.js'),
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: basePlugins,
    platform: 'node',
    resolve,
  })

  // Browser builds (без Node.js APIs)
  configs.push({
    input: browserEntry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.browser.mjs'),
      format: 'esm',
      sourcemap: true,
      exports: 'named',
    },
    external: external.filter(dep => !dep.startsWith('node:')),
    plugins: basePlugins,
    platform: 'browser',
    resolve,
  })

  configs.push({
    input: browserEntry,
    output: {
      file: path.join(ctx.artifactsDir, 'index.browser.js'),
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external: external.filter(dep => !dep.startsWith('node:')),
    plugins: basePlugins,
    platform: 'browser',
    resolve,
  })

  // Submodule builds - create separate entry points for each submodule
  // Note: Submodules are universal (not platform-specific) in most cases
  submodules.forEach(submodule => {
    // ESM build for submodule
    configs.push({
      input: submodule.path,
      output: {
        file: path.join(ctx.artifactsDir, `${submodule.name}.mjs`),
        format: 'esm',
        sourcemap: true,
        exports: 'named',
      },
      external,
      plugins: [],
      resolve,
    })

    // CommonJS build for submodule
    configs.push({
      input: submodule.path,
      output: {
        file: path.join(ctx.artifactsDir, `${submodule.name}.js`),
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
      external,
      plugins: [],
      resolve,
    })
  })

  // UMD build (только browser версия)
  const buildOptions = (ctx.packageJson as any).buildOptions
  if (buildOptions?.name) {
    const globalName = buildOptions.name.charAt(0).toUpperCase() + buildOptions.name.slice(1)

    configs.push({
      input: browserEntry,
      output: {
        file: path.join(ctx.artifactsDir, 'dist', `${buildOptions.name}.global.js`),
        format: 'umd',
        name: globalName,
        sourcemap: true,
        exports: 'named',
        globals: {
          '@alaq/nucleus': 'Nucleus',
          '@alaq/atom': 'Atom',
          'alak': 'Alak',
          'vue': 'Vue',
        }
      },
      external: [],
      plugins: basePlugins,
      platform: 'browser',
      resolve,
    })
  }

  return configs
}

/**
 * Главная функция создания конфигурации
 *
 * Автоматически определяет тип пакета и создает правильную конфигурацию
 */
export function createUnifiedConfig(ctx: UnifiedBuildContext): RolldownOptions[] {
  const entryPoints = detectEntryPoints(ctx)

  console.log(`[config] Building ${ctx.packageName}`)
  console.log(`[config] Type: ${entryPoints.type}`)

  if (entryPoints.submodules.length > 0) {
    console.log(`[config] Submodules: ${entryPoints.submodules.map(s => s.name).join(', ')}`)
  }

  if (entryPoints.type === 'platform-specific') {
    console.log(`[config] Node entry: ${path.relative(ctx.packageDir, entryPoints.node)}`)
    console.log(`[config] Browser entry: ${path.relative(ctx.packageDir, entryPoints.browser)}`)
    return createPlatformSpecificConfig(ctx, entryPoints.node, entryPoints.browser, entryPoints.submodules)
  } else {
    console.log(`[config] Universal entry: ${path.relative(ctx.packageDir, entryPoints.entry)}`)
    return createUniversalConfig(ctx, entryPoints.entry, entryPoints.submodules)
  }
}

// Helper for optional per-package rolldown.config.ts
// Packages can create minimal config by importing this function
export function defineConfig(packageDir: string, packageJson: PackageJson): RolldownOptions[] {
  const ctx: UnifiedBuildContext = {
    packageDir,
    packageName: packageJson.name || path.basename(packageDir),
    packageJson,
    artifactsDir: path.join(packageDir, 'artifacts'),
  }

  return createUnifiedConfig(ctx)
}
