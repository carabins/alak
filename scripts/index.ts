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

async function pre(target) {
  await test(target)
  await compile(target)
  upver(target)
}

const tasks = {
  compile,
  upver,
  publish,
  test,
  sync: syncDeps,
  pre,
  async up(target) {
    await pre(target)
    publish(target)
  },
}

const taskCommand = tasks[task.toLowerCase()]

if (!taskCommand) {
  console.log(`
(╯°□°)╯︵ ${task}
`)
  Log.error(`not found task`, `${task}`.toUpperCase())
  throw 'wrong command'
}

const target = process.argv[2] || 'all'

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

switch (target) {
  case 'all':
    Object.keys(projects).forEach((key) => {
      taskCommand(projects[key])
    })
    break
  default:
    const p = projects[target]
    if (!p) {
      console.log(`
(╯°□°)╯︵ ${target}
`)
      Log.error(`not found project`, `${target}`.toUpperCase())
      process.exit()
    } else {
      taskCommand(p)
    }
}
