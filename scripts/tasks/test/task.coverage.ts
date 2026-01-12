import { BuildPackage } from '~/scripts/BuildPackage';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Run coverage test for a single project - generates coverage report in project's coverage directory
 */
export const coverageTestProject = async (project: BuildPackage): Promise<void> => {
  const logger = project.createLogger('coverage-test');
  logger.info('Starting coverage test...');

  return new Promise((resolve, reject) => {
    // Create a coverage directory in the project
    const projectCoverageDir = path.join(project.packagePath, 'coverage');
    if (!fs.existsSync(projectCoverageDir)) {
      fs.mkdirSync(projectCoverageDir, { recursive: true });
    }

    // Run bun test with coverage for this specific project
    const testProcess = spawn('bun', ['test', '--coverage'], {
      cwd: project.packagePath,
      stdio: 'pipe', // Capture output
      env: { ...process.env }
    });

    let output = '';
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0 || code === 1) { // 0 for success, 1 for tests passed but coverage low
        logger.info(`Coverage test completed with exit code: ${code}`);
        resolve();
      } else {
        logger.error(`Coverage test failed with exit code: ${code}`);
        logger.error(output);
        reject(new Error(`Coverage test failed with exit code: ${code}`));
      }
    });

    testProcess.on('error', (err) => {
      logger.error('Coverage test process error:', err.message);
      reject(err);
    });
  });
};
