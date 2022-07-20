import { Log } from './log'
import * as fs from 'fs'
import { Const } from './common/constants'
import { initProject } from './common/project'
import { compile } from './task.compile'

import * as color from 'colorette'
import { publish, upver } from './task.publish'
import { test } from './task.test'
import { syncDeps } from '~/scripts/task.syncDeps'

const task = process.argv[3] || 'pre'

const pre = [upver, syncDeps, test, compile]
const up = [...pre, publish]
const pipeLines = { pre, up }

const tasks = {
  compile,
  upver,
  publish,
  test,
  sync: syncDeps,
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

const target = process.argv[2]

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
console.log('  task', color.bold(task.toUpperCase()))
console.log('target', color.bold(target))

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

const z = target.split(',')
if (z.length) {
  job.projects = z.map(getProject)
} else {
  job.projects.push(getProject(target))
}

job.pipeLine.forEach(async (task) => {
  Log(color.bold('NEXT TASK'), task.name)
  await job.projects.map((p) => task(p))
})
