import { BuildPackage } from '~/scripts/BuildPackage';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Run coverage test for a single project and save text report to coverage/[name].txt
 */
export const coverageTextReport = async (project: BuildPackage): Promise<void> => {
  const logger = project.createLogger('coverage-text-report');
  logger.info('Starting coverage text report generation...');

  return new Promise((resolve, reject) => {
    // Create a coverage directory in the project
    const projectCoverageDir = path.join(process.cwd(), 'coverage');
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
        // Write the formatted text coverage report to a file named after the project
        const reportPath = path.join(process.cwd(), 'coverage', `${project.id}.txt`);

        // Parse the output to identify the summary stats at the end
        const outputLines = output.split('\n');

        // Find test summary lines (typically at the end): pass, fail, expect calls, Ran tests
        const summaryStartIndex = outputLines.findIndex((line, index) => {
          // Look for the start of summary section
          return line.includes('pass') ||
                 line.includes('fail') ||
                 line.includes('expect() calls') ||
                 (line.includes('Ran') && line.includes('tests'));
        });

        if (summaryStartIndex !== -1) {
          const beforeSummary = outputLines.slice(0, summaryStartIndex);
          const summaryLines = outputLines.slice(summaryStartIndex);

          // Find the coverage table (it typically has a "File | % Funcs | % Lines | Uncovered" header format)
          let coverageStartIndex = -1;
          let coverageEndIndex = -1;

          for (let i = 0; i < beforeSummary.length; i++) {
            if (beforeSummary[i].includes('File') &&
                beforeSummary[i].includes('% Funcs') &&
                beforeSummary[i].includes('% Lines')) {
              coverageStartIndex = i;
              // Find where the table ends (after the last line with actual coverage data)
              for (let j = i + 1; j < beforeSummary.length; j++) {
                if (beforeSummary[j].trim() === '' &&
                    j > i + 1 &&
                    !beforeSummary[j-1].includes('|')) {
                  coverageEndIndex = j;
                  break;
                }
              }
              // If we reach the end without finding an empty line after coverage data
              if (coverageEndIndex === -1) {
                coverageEndIndex = beforeSummary.length;
              }
              break;
            }
          }

          if (coverageStartIndex !== -1 && coverageEndIndex !== -1) {
            // Extract the coverage table
            const coverageTable = beforeSummary.slice(coverageStartIndex, coverageEndIndex);

            // Extract content before the coverage table
            const contentBeforeTable = beforeSummary.slice(0, coverageStartIndex);

            // Extract content after the coverage table but before summary
            const contentAfterTable = beforeSummary.slice(coverageEndIndex);

            // Check if tests passed (no failures)
            const hasFailures = summaryLines.some(line =>
              /fail/.test(line) && !/0\s+fail/.test(line)
            );

            if (!hasFailures) {
              // Reorganize: coverage table + before + after + summary
              const reorderedOutput = [
                ...coverageTable,
                '',
                ...contentBeforeTable,
                ...contentAfterTable,
                ...summaryLines
              ].join('\n');

              fs.writeFileSync(reportPath, reorderedOutput);
              logger.info(`Formatted coverage text report saved to ${reportPath}`);
            } else {
              // If there are failures, save original output
              fs.writeFileSync(reportPath, output);
              logger.info(`Coverage text report saved to ${reportPath} (with failures, original format preserved)`);
            }
          } else {
            // If no coverage table found, save original output
            fs.writeFileSync(reportPath, output);
            logger.info(`Coverage text report saved to ${reportPath} (no coverage table found)`);
          }
        } else {
          // If no summary found, save original output
          fs.writeFileSync(reportPath, output);
          logger.info(`Coverage text report saved to ${reportPath} (no summary found)`);
        }

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
