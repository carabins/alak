import { BuildPackage } from '~/scripts/BuildPackage'
import { RolldownBuilder } from './RolldownBuilder'
import { detectEntryPoints } from './PackageJsonGenerator'

export default async function (project: BuildPackage): Promise<void> {

  const logger = project.createLogger('rolldown')

  const sourceDir = project.packagePath
  const artifactsDir = project.artPatch
  const packageName = project.packageJson.name!
  const entryPoints = detectEntryPoints(sourceDir)

  const dependencies = Object.keys(project.packageJson.dependencies || {})
  const peerDependencies = Object.keys(project.packageJson.peerDependencies || {})

  logger.info(`Building ${packageName}`)

  const builder = new RolldownBuilder({
    sourceDir,
    artifactsDir,
    entryPoints,
    packageName,
    dependencies,
    peerDependencies,
  })

  const success = await builder.build()
  if (!success) throw new Error('Rolldown build failed')

  logger.info(`Build complete`)
}
