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
  } catch (error) {
    logger.error('Failed to generate package.json:', error)
    throw error
  }
}
