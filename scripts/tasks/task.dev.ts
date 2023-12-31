import {devTestFile, testProjects} from "~/scripts/tasks/task.test";
import {Project} from '../common/project'
import * as path from 'path'
import {FileLog} from '../log'
import chokidar from 'chokidar'

import {projects} from "~/scripts/now";
import {bench} from "~/scripts/common/bench";
import {exec} from "child_process";
import * as process from "process";

const {Worker} = require('node:worker_threads')

export async function dev(t?: Project[]) {
  const log = FileLog('dev')
  const marked = {}
  log.warn("use Ctrl+C to exit")
  log.info("packages start watch")
  chokidar.watch('packages').on('change', async (target) => {
    log.debug('\nRELOAD')
    log.debug(target)
    const [pak, project, ctx, file] = target.split(path.sep)
    const b = bench()
    if (projects[project]) {
      switch (ctx) {
        case 'src':
          await testProjects([projects[project]])
          log.debug(b(), "DONE", target)
          break
        case 'test':
          if (file.endsWith(".test.ts")) {
            await devTestFile(file, projects[project], log)
            log.debug(b(), "DONE", target)
          } else {
            const child = exec("node -r @swc-node/register -r tsconfig-paths/register " + target)
            child.stdout.pipe(process.stdout)
            child.stderr.pipe(process.stderr)
          }
      }
    }
  })
}
