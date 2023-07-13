import { Log } from './log'
import * as fs from 'fs'
import { Const } from './common/constants'
import { initProject } from './common/project'
import { compile } from './task.compile'

import * as color from 'colorette'
import { publish, upver } from './task.publish'
import { test } from './task.test'
import { syncDeps } from '~/scripts/task.syncDeps'
import { push } from '~/scripts/task.push'
import { initGit } from '~/scripts/common/git'
import { getLine } from '~/scripts/common/oneLine'
import * as process from 'process'

const task = process.argv[2] || 'test'

const commit = {
  name: 'commit',
  isCommit: true,
}

const pre = [upver, syncDeps, test, compile]
const up = [compile, commit]
const pipeLines = { pre, up }

const tasks = {
  compile,
  upver,
  publish,
  test,
  sync: syncDeps,
  commit,
}

const taskName = task.toLowerCase()
const job = {
  projects: [],
  pipeLine: tasks[taskName] ? [tasks[taskName]] : pipeLines[taskName],
}
if (!job.pipeLine?.length) {
  console.log(`
(╯°□°)╯︵ ${task}
`)
  Log.error(`not found pipeline/task`, `${task}`.toUpperCase())
  Log('Commands', Object.keys(tasks))
  Log('Pipelines', Object.keys(pipeLines))
  throw 'wrong command'
}

const packs = fs.readdirSync(Const.PACKAGES)
const projects = {}
export const versions = {}

packs.forEach((f) => {
  const p = initProject(f)
  if (p) {
    projects[f] = p
    versions[p.packageJson.name] = p.packageJson.version
  }
})

function getProject(target) {
  const p = projects[target]
  if (!p) {
    console.log(`
(╯°□°)╯︵ ${target}
`)
    Log.error(`not found project`, `${target}`.toUpperCase())
    process.exit()
  }
  return p
}

initGit(projects).then(async (git) => {
  if (task === 'commit') {
  }
  const changes = git.affected.join(',')
  const target = task !== 'commit' ? process.argv[3] || changes : changes
  console.log(`
      o
       o
     ___
     | |
     | |
     |o|
    .' '.
   /  o  \\
  :____o__:
  '._____.'`)

  console.log(color.dim('tasks'), '\t\t', color.bold(task.toUpperCase()))
  console.log('\t\t', color.bold(target))

  const targets = target.toLowerCase().split(',')
  if (targets.length) {
    job.projects = targets.map(getProject)
  } else {
    job.projects.push(getProject(target))
  }
  async function runPipeLine() {
    for (const t of job.pipeLine) {
      Log(color.bold('TASK'), t.name)
      if (t.isCommit) {
        await git.commit(task == 'commit' ? process.argv[3] : false)
      } else {
        await Promise.all(job.projects.map(t))
      }
    }
  }
  await runPipeLine()
  Log(color.bold('Complete'))
})
