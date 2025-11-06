import { BuildPackage } from '~/scripts/BuildPackage'
import { getPackageVersions } from '~/scripts/common/utils/publish'
import { packageRegistry } from '~/scripts/common/scan.projects'

/**
 * Task to update NPM version for a specific project
 */
export async function updateProjectNpmVersion(project: BuildPackage): Promise<void> {
  const logger = project.createLogger('update-npm-version');

  try {
    const npmInfo = getPackageVersions(project.packageJson.name as string);

    if (npmInfo) {
      project.npmVersion = npmInfo['dist-tags'].latest || project.packageJson.version as string;
      logger.info(`Updated npm version to ${project.npmVersion}`);
    } else {
      // If not found on npm, use local version
      project.npmVersion = project.packageJson.version as string;
      logger.info(`Package not found on npm, using local version ${project.npmVersion}`);
    }
  } catch (error) {
    logger.error(`Failed to update NPM version:`, error);
    throw error;
  }
}

/**
 * Task to update NPM versions for all projects
 */
export async function updateAllProjectsNpmVersion(): Promise<void> {
  for (const project of Object.values(packageRegistry.all)) {
    await updateProjectNpmVersion(project);
  }
}
