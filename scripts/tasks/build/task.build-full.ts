/**
 * Build task with inlined dependencies (for unpkg-like standalone bundle)
 */
import { BuildPackage } from '~/scripts/BuildPackage'
import { detectEntryPoints, readRootPackageJson } from './PackageJsonGenerator'
import * as path from 'path'
import { rolldown } from 'rolldown'
import * as fs from 'fs'

export default async function buildFullBundle(pkg: BuildPackage): Promise<void> {
  const log = pkg.createLogger('build-full')

  log.info('Building standalone bundle with inlined dependencies...')

  const sourceDir = pkg.packagePath
  const artifactsDir = pkg.artPatch
  const entryPoints = detectEntryPoints(sourceDir)

  const mainEntry = entryPoints.find(e => e.name === 'index')
  if (!mainEntry) {
    throw new Error('No main entry point found')
  }

  const pkgShort = pkg.packageJson.name?.split('/').pop()!
  const globalName = pkgShort
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

  log.info(`Entry: ${mainEntry.path}`)
  log.info(`Output: ${pkgShort}.standalone.min.js`)

  const commonOptions = {
    input: mainEntry.path,
    resolve: {
      alias: {
        '@alaq/quark': path.resolve('packages/quark/src/index.ts'),
        '@alaq/quark/*': path.resolve('packages/quark/src/*'),
      },
    },
    external: [],  // Inline everything (no externals)
  }

  // Production bundle (__DEBUG__ = false, minified)
  const prodBundle = await rolldown({
    ...commonOptions,
    define: { __DEBUG__: 'false' },
  })

  const prodFile = path.join(artifactsDir, `${pkgShort}.standalone.min.js`)
  await prodBundle.write({
    format: 'umd',
    file: prodFile,
    name: globalName,
    exports: 'named',
    minify: true,
  })

  const prodStats = fs.statSync(prodFile)
  log.info(`✅ Production bundle: ${(prodStats.size / 1024).toFixed(2)} KB`)

  // Debug bundle (__DEBUG__ = true, not minified)
  const debugBundle = await rolldown({
    ...commonOptions,
    define: { __DEBUG__: 'true' },
  })

  const debugFile = path.join(artifactsDir, `${pkgShort}.standalone.debug.js`)
  await debugBundle.write({
    format: 'umd',
    file: debugFile,
    name: globalName,
    exports: 'named',
    minify: false,
  })

  const debugStats = fs.statSync(debugFile)
  log.info(`✅ Debug bundle: ${(debugStats.size / 1024).toFixed(2)} KB`)
}
