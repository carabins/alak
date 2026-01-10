import path from "path";
import fs from "fs";
import {scanTaskAndAggregateFiles, TaskFiles} from "~/scripts/common/exec.task";
import {createModuleLogger, Log} from "~/scripts/log";
import {TaskPipeline} from "~/scripts/config.pipes";
import {BuildPackage} from "~/scripts/BuildPackage";
import {packageRegistry} from "~/scripts/common/scan.projects";


export async function initExecutor() {
  const tasksDir = path.resolve("scripts/tasks")
  const data = await scanTaskAndAggregateFiles(tasksDir)
  const buildString = v => v.map(s => `"${s}"`).join(" | ")
  const BuildBaseTaskNames = buildString(data.taskFiles)
  const BuildAggregateTaskNames = buildString(data.aggregateFiles)
  const typeGen = `// generated from ${tasksDir}
declare type BuildBaseTaskNames = ${BuildBaseTaskNames}
declare type BuildAggregateTaskNames = ${BuildAggregateTaskNames}

`
  const tasksFile = path.resolve("scripts/tasks.d.ts")
  let prevFile = "";
  try {
    if (fs.existsSync(tasksFile)) {
      prevFile = fs.readFileSync(tasksFile, 'utf-8');
    }
  } catch (error) {
    Log.trace(`Error reading ${tasksFile}: ${error}`);
  }

  if (prevFile != typeGen) {
    Log.info(`update ${tasksFile}`)
    fs.writeFileSync(tasksFile, typeGen)
  }
  return Object.assign(data, {
    async runPipe(pipeline: TaskPipeline, libNames: string[]) {
      const startTime = Date.now()
      const logger = createModuleLogger("task-executor")
      const targets = libNames.map(l=>packageRegistry.all[l])
      try {
        if (pipeline.aggregate) {
          logger.info(`Starting aggregate: ${pipeline.name}`)
          for (const taskName of pipeline.aggregate) {
            await data.runTask(taskName, targets)
          }
        }

        // Run pipeline tasks sequentially - each task runs on every project
        if (pipeline.pipeline) {
          logger.info(`Starting pipe: ${pipeline.name}`)
          for (const taskName of pipeline.pipeline) {
            for (const l of targets) {
              await data.runTask(taskName,l)
            }
          }
        }



        const duration = Date.now() - startTime
        logger(`Task completed successfully in ${duration}ms`)
        return { success: true, duration }
      } catch (error) {
        const duration = Date.now() - startTime
        console.error(`Task failed after ${duration}ms`, error)
        return { success: false, error: error as Error, duration }
      }
    }
  })
}
