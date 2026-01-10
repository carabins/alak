import { BuildPackage } from '~/scripts/BuildPackage';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Generates HTML report from lcov.info file using @lcov-viewer/cli
 */
export default async (projects: BuildPackage[]): Promise<void> => {
  const logger = projects.length > 0 ? projects[0].createLogger('generate-lcov-html') : console;
  logger.info('Generating HTML report from lcov.info using @lcov-viewer/cli');

  // Get lcov content from project state
  let lcovContent: string | undefined;
  if (projects.length > 0) {
    lcovContent = projects[0].state['lcov'] as string;
  }

  if (!lcovContent) {
    logger.error('No lcov content found in project state. Run aggregate-lcov task first.');
    throw new Error('No lcov content found in project state');
  }

  // Create coverage directory and write lcov content temporarily
  const coverageDir = path.join(process.cwd(), 'coverage');
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }

  const lcovPath = path.join(coverageDir, 'lcov.info');
  fs.writeFileSync(lcovPath, lcovContent);

  // Create html output directory
  const htmlOutputDir = path.join(process.cwd(), 'coverage', 'html');
  if (!fs.existsSync(htmlOutputDir)) {
    fs.mkdirSync(htmlOutputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    logger.info('Executing: bunx @lcov-viewer/cli lcov -o ./coverage/html ./coverage/lcov.info');

    const htmlProcess = spawn('bunx', [
      '@lcov-viewer/cli',
      'lcov',
      '-o',
      './coverage/html',
      './coverage/lcov.info'
    ], {
      cwd: process.cwd(),
      stdio: 'inherit', // Show output directly to console
      env: { ...process.env }
    });

    htmlProcess.on('close', (code) => {
      // Clean up temporary lcov.info file after processing
      try {
        fs.unlinkSync(lcovPath);
      } catch (cleanupError) {
        logger.warn('Could not clean up temporary lcov.info file:', cleanupError.message);
      }

      if (code === 0) {
        logger.info('HTML report generated successfully in ./coverage/html');
        resolve();
      } else {
        logger.error(`@lcov-viewer/cli process exited with code ${code}`);
        reject(new Error(`@lcov-viewer/cli process failed with exit code ${code}`));
      }
    });

    htmlProcess.on('error', (err) => {
      logger.error('@lcov-viewer/cli process error:', err.message);
      reject(err);
    });
  });
};
