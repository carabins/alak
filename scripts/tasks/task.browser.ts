import { BuildPackage } from '~/scripts/BuildPackage'
import { rollup, type ModuleFormat, type OutputOptions, type Plugin } from 'rollup'
import path from 'path'
import { existsSync } from 'fs'
import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import * as fs from 'fs-extra'
import { FileLog } from '~/scripts/log'

// Browser build formats - minified with sourcemaps
type BrowserFormat = 'esm-browser' | 'global'

interface BuildConfig {
  name?: string // Global variable name for IIFE builds
  formats?: BrowserFormat[]
  sideEffects?: boolean
}

const DEFAULT_FORMATS: BrowserFormat[] = ['global']

export async function browser(project: BuildPackage) {
  const log = FileLog(project.packageJson.name + ' browser')

  // Read build configuration from package.json
  const rawBuildOptions = project.packageJson.buildOptions
  const buildOptions: BuildConfig =
    typeof rawBuildOptions === 'object' && rawBuildOptions !== null && !Array.isArray(rawBuildOptions)
      ? (rawBuildOptions as BuildConfig)
      : {}
  const formats = buildOptions.formats || DEFAULT_FORMATS
  const globalName = buildOptions.name || project.dir
  const sideEffects = buildOptions.sideEffects ?? false

  // Skip if no formats configured
  if (!formats || formats.length === 0) {
    log.info('skip - no formats configured in buildOptions')
    return
  }

  const input = path.join(project.packagePath, 'src', 'index.ts')
  const distName = 'dist'
  const outDir = path.join(project.artPatch, distName)
  const pkgName = project.dir

  // Clean and prepare output directory
  if (fs.existsSync(outDir)) {
    fs.removeSync(outDir)
  }
  fs.mkdirpSync(outDir)

  // Helper to generate output file names - always minified for browser
  const getFileName = (format: BrowserFormat): string => {
    switch (format) {
      case 'esm-browser':
        return `${pkgName}.esm-browser.js`
      case 'global':
        return `${pkgName}.global.js`
      default:
        return `${pkgName}.js`
    }
  }

  // Map BrowserFormat to Rollup format
  const getRollupFormat = (format: BrowserFormat): ModuleFormat => {
    switch (format) {
      case 'esm-browser':
        return 'es'
      case 'global':
        return 'iife'
      default:
        return 'es'
    }
  }

  try {
    log.info(`Building browser formats: ${formats.join(', ')}`)

    // Build each format (all minified with sourcemaps)
    for (const format of formats) {
      const plugins: Plugin[] = [
        typescript({
          noEmitOnError: true,
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          declaration: false,
          exclude: [path.resolve(project.dir, 'test'), path.resolve('scripts')],
          outDir: outDir,
        }),
        // Always minify browser builds
        terser(),
      ]

      // Keep only Vue external (bundle internal dependencies for browser)
      const external = ['vue']

      const bundle = await rollup({
        input,
        plugins,
        external,
      })

      const output: OutputOptions = {
        format: getRollupFormat(format),
        file: path.join(outDir, getFileName(format)),
        name: globalName,
        exports: 'named' as const,
        globals: {
          vue: 'Vue',
        },
        sourcemap: true,
      }

      await bundle.write(output)
      await bundle.close()

      log.info(`Built ${getFileName(format)} (minified with sourcemap)`)
    }

    // Update package.json - we already did most setup in compile task, but we add unpkg here
    project.packageJson.unpkg = `${distName}/${pkgName}.global.js`
    
    // We can also ensure sideEffects is set if provided
    if (sideEffects !== undefined) {
         project.packageJson.sideEffects = sideEffects
    }

    project.savePackageJsonTo.art()

    log.info(`✓ Built browser bundles: ${formats.join(', ')}`)
    log.info(`✓ Browser (unpkg): ${distName}/${pkgName}.global.js (minified)`)
  } catch (error) {
    log.error(`Build failed: ${error.message}`)
    throw error
  }
}

export default browser
