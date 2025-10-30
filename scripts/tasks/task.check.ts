import {devTestFile, testProjects} from '~/scripts/tasks/task.test'
import {Project} from '../common/project'
import * as path from 'path'
import {FileLog} from '../log'
import chokidar from 'chokidar'

import {projects} from '~/scripts/now'
import {bench} from '~/scripts/common/bench'
import {exec} from 'child_process'
import * as process from 'process'

const {Worker} = require('node:worker_threads')

function pick(obj, ...keys) {
  const result = {};

  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }

  return result;
}

export async function check(t?: Project) {
  const log = FileLog('dev')
  const marked = {}
  const clearJson = pick(t.packageJson, "name", "version", "description", "keywords", "dependencies")

}
