import { BuildPackage } from '~/scripts/BuildPackage';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Aggregates lcov.info files from multiple projects into a single coverage report
 */
export default async (projects: BuildPackage[]): Promise<void> => {
  const logger = projects.length > 0 ? projects[0].createLogger('aggregate-lcov') : console;
  logger.info(`Aggregating lcov coverage for ${projects.length} projects`);

  // Find all lcov.info files from projects
  const lcovFiles: string[] = [];

  for (const project of projects) {
    const projectLcovPath = path.join(project.packagePath, 'coverage', 'lcov.info');
    if (fs.existsSync(projectLcovPath)) {
      lcovFiles.push(projectLcovPath);
      logger.info(`Found lcov.info for project ${project.id} at ${projectLcovPath}`);
    } else {
      logger.warn(`No lcov.info found for project ${project.id} at ${projectLcovPath}`);
    }
  }

  if (lcovFiles.length === 0) {
    logger.warn('No lcov.info files found to aggregate. Run coverage tests first.');
    return;
  }

  // Read and combine all lcov files
  let combinedContent = '';
  for (const lcovFile of lcovFiles) {
    const content = fs.readFileSync(lcovFile, 'utf-8');

    // Process content to fix file paths relative to project root
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('SF:')) {
        // Extract the file path after 'SF:'
        const filePath = line.substring(3); // Remove 'SF:' prefix
        // Make sure the path is relative to the project for consistency
        const normalizedPath = path.join(path.dirname(lcovFile), filePath).replace(/\\/g, '/');
        combinedContent += `SF:${normalizedPath}\n`;
      } else {
        combinedContent += `${line}\n`;
      }
    }
  }

  // Store the combined lcov info in the first project's state to share with other tasks
  if (projects.length > 0) {
    projects[0].state['lcov'] = combinedContent;
  }

  logger.info(`Successfully aggregated coverage from ${lcovFiles.length} project(s)`);
};
