import path from 'path';
import {readdir, stat} from 'fs/promises';
import {createModuleLogger} from '../log';

const logger = createModuleLogger('>');

/**
 * Recursively scans a directory for files matching the given pattern.
 * @param dirPath Directory to scan.
 * @param pattern Pattern to match (function that takes a filename and returns boolean).
 * @returns Array of matching file paths.
 */
async function scanDirectory(dirPath: string, pattern: (fileName: string) => boolean): Promise<string[]> {
  try {
    const files = await readdir(dirPath, { recursive: true });
    return files
      .filter(f => pattern(path.basename(f)))
      .map(f => path.join(dirPath, f));
  } catch (error) {
    logger.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

export type TaskFiles = {
  taskFiles: string[],
  aggregateFiles: string[],
  allTask: Map<string, "aggregate" | "pipe">,
  getTask: (name: string) => Promise<any>,
  getAggregate: (name: string) => Promise<any>
  runTask: (name: string, data: any) => Promise<any>
}

/**
 * Scans for files starting with 'task.' or 'aggregate.'
 * @param searchDir Directory to search in
 * @returns Object containing arrays of file names without the .ts extension and before *task. and helper functions to import modules
 */
export async function scanTaskAndAggregateFiles(searchDir: string): Promise<TaskFiles> {
  // logger.trace(`Scanning directory: ${searchDir} for task and aggregate files`);

  // Find all files starting with 'task.' and ending with '.ts', including subdirectories
  const taskFiles = await scanDirectory(searchDir, (fileName) =>
    fileName.startsWith('task.') && fileName.endsWith('.ts')
  );

  // Find all files starting with 'aggregate.' and ending with '.ts', including subdirectories
  const aggregateFiles = await scanDirectory(searchDir, (fileName) =>
    fileName.startsWith('aggregate.') && fileName.endsWith('.ts')
  );

  // logger.trace(`Found ${taskFiles.length} task files and ${aggregateFiles.length} aggregate files`);

  const allTask = new Map<string, "aggregate" | "pipe">();

  // Create maps for quick lookup of file paths by task/aggregate names
  const taskPathMap = new Map<string, string>();
  const formattedTaskFiles = taskFiles.map(file => {
    const fileName = path.basename(file, '.ts');
    const result = fileName.replace(/^task\.?/, ''); // Remove 'task.' prefix
    // logger.trace(`Formatted task file: ${fileName} -> ${result}`);
    allTask.set(result, "pipe");
    taskPathMap.set(result, file); // Map task name to its full path
    return result;
  });

  const aggregatePathMap = new Map<string, string>();
  const formattedAggregateFiles = aggregateFiles.map(file => {
    const fileName = path.basename(file, '.ts');
    const result = fileName.replace(/^aggregate\.?/, ''); // Remove 'aggregate.' prefix
    allTask.set(result, "aggregate");
    aggregatePathMap.set(result, file); // Map aggregate name to its full path
    return result;
  });

  logger.trace(`Tasks: ${Array.from(taskPathMap.keys()).join(', ')}`);
  logger.trace(`Aggregions: ${Array.from(aggregatePathMap.keys()).join(', ')}`);


  // Define the getTask function to import a task module and return its default export
  const getTask = async (name: string) => {
    const modulePath = taskPathMap.get(name) || path.join(searchDir, `task.${name}.ts`);
    logger.trace(`Importing task module: ${modulePath}`);
    try {
      const module = await import(modulePath);
      return module.default;
    } catch (error) {
      logger.error(`Failed to import task module ${modulePath}:`, error);
      throw error;
    }
  };

  const moduleCache = new Map<string, any>();
  const getAggregate = async (name: string) => {
    const modulePath = aggregatePathMap.get(name) || path.join(searchDir, `aggregate.${name}.ts`);
    logger.trace(`Importing aggregate module: ${modulePath}`);

    try {
      // Check if module is already cached
      if (moduleCache.has(modulePath)) {
        return moduleCache.get(modulePath);
      }

      logger.trace(`Importing aggregate module: ${modulePath}`);
      const module = await import(modulePath);

      // Cache the module for future use
      moduleCache.set(modulePath, module.default);
      return module.default;
    } catch (error) {
      logger.error(`Failed to import aggregate module ${modulePath}:`, error);
      throw error;
    }
  };

  // Define the runTask function to import and run a task module with caching
  const runTask = async (name: string, data: any) => {
    const modulePath = taskPathMap.get(name) || aggregatePathMap.get(name)
    logger.trace(`Running task module: ${modulePath}`);

    try {
      // Check if module is already cached
      if (moduleCache.has(modulePath)) {
        const task = moduleCache.get(modulePath);
        return task(data);
      }

      const module = await import(modulePath);

      // Cache the module for future use
      moduleCache.set(modulePath, module.default);

      // Execute the task with provided data
      return module.default(data);
    } catch (error) {
      logger.error(`Failed to import or run task module ${modulePath}:`, error);
      throw error;
    }
  };

  return {
    allTask,
    taskFiles: formattedTaskFiles,
    aggregateFiles: formattedAggregateFiles,
    getTask,
    getAggregate,
    runTask
  };
}
