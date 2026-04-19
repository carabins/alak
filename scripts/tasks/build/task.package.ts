import {BuildPackage} from '~/scripts/BuildPackage'
import {
  detectEntryPoints,
  PackageJsonGenerator,
  readRootPackageJson
} from '~/scripts/tasks/build/PackageJsonGenerator'

/**
 * Generate package.json for a project using PackageJsonGenerator
 */
export default async function (project: BuildPackage): Promise<void> {
  const logger = project.createLogger('generate-package-json')

  try {
    const artifactsDir = project.artPatch
    const sourceDir = project.packagePath
    const sourcePackageJson = project.packageJson
    const rootPackageJson = readRootPackageJson()
    const entryPoints = detectEntryPoints(sourceDir)

    // logger.info(`Source directory: ${sourceDir}`)
    // logger.info(`Artifacts directory: ${artifactsDir}`)
    // logger.info(`Detected entry points: ${entryPoints.length}`)

    // Generate package.json
    const generator = new PackageJsonGenerator({
      sourceDir,
      artifactsDir,
      sourcePackageJson,
      rootPackageJson,
      entryPoints,
    })

    const packageJson = generator.generate()


    // Save to artifacts directory, not to source
    const fs = await import('fs')
    const path = await import('path')

    // Ensure artifacts directory exists
    await fs.promises.mkdir(artifactsDir, {recursive: true})

    const packageJsonPath = path.join(artifactsDir, 'package.json')
    logger.trace(packageJsonPath)
    await fs.promises.writeFile(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2)
    )
    logger.info(`Detected entry points : ${entryPoints.length}`)
    entryPoints.forEach(entryPoint => {
      logger.debug(`Found ${entryPoint.name}`)
    })

    // License handling:
    // Apache-2.0 licensed packages get the canonical Apache text from the
    // repo root (LICENSE-APACHE). Other licenses (if any) are left alone —
    // the package must ship its own LICENSE file in its directory in that
    // case, or this step is extended.
    //
    // See root LICENSE §"Scope and precedence" for the two-layer license
    // model that makes this necessary.
    const declaredLicense = (packageJson as any).license as string | undefined
    if (declaredLicense === 'Apache-2.0') {
      // Resolve repo root relative to this file (scripts/tasks/build/).
      // ESM-safe: use import.meta.url instead of __dirname.
      const { fileURLToPath } = await import('node:url')
      const thisDir = path.dirname(fileURLToPath(import.meta.url))
      const repoRoot = path.resolve(thisDir, '..', '..', '..')
      const rootApacheLicense = path.join(repoRoot, 'LICENSE-APACHE')
      const targetLicense = path.join(artifactsDir, 'LICENSE')
      try {
        await fs.promises.copyFile(rootApacheLicense, targetLicense)
        logger.debug(`Copied LICENSE-APACHE → ${targetLicense}`)
      } catch (err: any) {
        logger.error(
          `Apache-2.0 package "${packageJson.name}" but root LICENSE-APACHE ` +
          `missing at ${rootApacheLicense}. Cannot produce a compliant tarball.`
        )
        throw err
      }
    }

    // Copy the package's own README if present. npm shows it on the package
    // page; missing README = sad empty page.
    const sourceReadme = path.join(sourceDir, 'README.md')
    const targetReadme = path.join(artifactsDir, 'README.md')
    try {
      await fs.promises.access(sourceReadme)
      await fs.promises.copyFile(sourceReadme, targetReadme)
      logger.debug(`Copied README.md`)
    } catch {
      // README is soft-required — warn but don't fail. Author can add one later.
      logger.warn(`No README.md in ${sourceDir} — package will ship without one`)
    }
  } catch (error) {
    logger.error('Failed to generate package.json:', error)
    throw error
  }
}
