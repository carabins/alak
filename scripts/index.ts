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
import { git, initGit } from '~/scripts/common/git'

const task = process.argv[3] || 'test'

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
const git = initGit(projects)
git.commit().then(() => {
  // console.log(projects)
})

// const arg2 = process.argv[2] || 'all'
// const target = arg2 === 'all' ? Object.keys(projects).join(',') : arg2
//
// console.log(`
//       o
//        o
//      ___
//      | |
//      | |
//      |o|
//     .' '.
//    /  o  \\
//   :____o__:
//   '._____.'`)
//
// console.log('  task', color.bold(task.toUpperCase()))
// console.log('target', color.bold(target))
//
// function getProject(target) {
//   const p = projects[target]
//   if (!p) {
//     console.log(`
// (╯°□°)╯︵ ${target}
// `)
//     Log.error(`not found project`, `${target}`.toUpperCase())
//     process.exit()
//   }
//   return p
// }
//
// const z = target.split(',')
// if (z.length) {
//   job.projects = z.map(getProject)
// } else {
//   job.projects.push(getProject(target))
// }
//
// async function runPipeLine() {
//   for (const task of job.pipeLine) {
//     Log(color.bold('NEXT TASK'), task.name)
//     await Promise.all(job.projects.map((p) => task(p)))
//   }
// }
//
// runPipeLine()
