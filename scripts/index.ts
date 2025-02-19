import select from '@inquirer/select'
import checkbox from '@inquirer/checkbox'
import { buildTask, getProjectChoices, getTaskChoices, startTask, xTask } from '~/scripts/tasks'
import { getAffected } from '~/scripts/common/git'
import { projects } from '~/scripts/now'
import { coverageTest, testProjects } from '~/scripts/tasks/task.test'
import { bench } from '~/scripts/common/bench'
import { Log } from '~/scripts/log'
import { dev } from '~/scripts/tasks/task.dev'

async function start() {
  console.clear()
  const fullBench = bench()
  const allProjects = Object.values(projects)
  const affectedList = await getAffected()
  const affectedObj = affectedList.map((id) => projects[id])
  const affectedStr = affectedList.join(', ')

  let selectedTask
  switch (process.argv[2]) {
    case 'build':
      return await startTask(buildTask, [projects['vue']])
    case 'cover':
      return coverageTest()
    case 'test':
      return testProjects(allProjects)
    case 'dev':
      return dev()
    case 'up':
      selectedTask = getTaskChoices(affectedStr)[0].value
    case 'x':
      return await startTask(xTask, [projects['alak'], projects['atom']])
  }
  if (!selectedTask) {
    selectedTask = await select({
      message: 'Select a task',
      choices: getTaskChoices(affectedStr),
    })
  }

  let selectedProjects: any = selectedTask.affected ? affectedObj : Object.values(projects)

  if (selectedTask.selectProjectsDialog) {
    selectedProjects = await select({
      message: 'Select a project',
      choices: getProjectChoices(affectedObj, affectedStr),
    })

    if (!selectedProjects) {
      selectedProjects = await checkbox({
        message: 'Select a project',
        choices: Object.values(projects).map((p) => {
          return {
            name: p.packageJson.name,
            description: p.packageJson.description,
            value: p,
          }
        }),
        pageSize: Object.keys(projects).length,
      })
    }
  }
  await startTask(selectedTask, selectedProjects)
  Log.info('total time ', fullBench())
}

start()

// import { Log } from './log'
// import * as fs from 'fs'
// import { Const } from './common/constants'
// import { initProject } from './common/project'
// import { compile } from './task.compile'
//
// import * as color from 'colorette'
// import { publish, upver } from './task.publish'
// import { test } from './task.test'
// import { syncDeps } from '~/scripts/task.syncDeps'
// import { push } from '~/scripts/task.push'
// import { initGit } from '~/scripts/common/git'
// import { getLine } from '~/scripts/common/oneLine'
// import * as process from 'process'
// import { doc } from '~/scripts/common/doc'
//
// const task = process.argv[2] || 'test'
//
// const commit = {
//   name: 'commit',
//   isCommit: true,
// }
//
// const pre = [upver, syncDeps, test, compile]
// const up = [upver, syncDeps, test, compile, publish, commit]
// const pipeLines = { pre, up }
//
// const tasks = {
//   compile,
//   upver,
//   publish,
//   test,
//   doc,
//   sync: syncDeps,
//   commit,
// }
//
// const taskName = task.toLowerCase()
// const job = {
//   projects: [],
//   pipeLine: tasks[taskName] ? [tasks[taskName]] : pipeLines[taskName],
// }
// if (!job.pipeLine?.length) {
//   console.log(`
// (╯°□°)╯︵ ${task}
// `)
//   Log.error(`not found pipeline/task`, `${task}`.toUpperCase())
//   Log('Commands', Object.keys(tasks))
//   Log('Pipelines', Object.keys(pipeLines))
//   throw 'wrong command'
// }
//
// const packs = fs.readdirSync(Const.PACKAGES)
// const projects = {}
// export const versions = {}
//
// packs.forEach((f) => {
//   const p = initProject(f)
//   if (p) {
//     projects[f] = p
//     versions[p.packageJson.name] = p.packageJson.version
//   }
// })
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
// initGit(projects).then(async (git) => {
//   let changes = git.affected.join(',')
//   if (!changes) {
//     Log.info('no one changes')
//   }
//   const target = (function () {
//     switch (task) {
//       case 'commit':
//         return process.argv[3]
//       case 'test':
//         return Object.keys(projects).join(',')
//       default :
//         return process.argv[3] ? process.argv[3] : changes
//     }
//   })()
//
//   console.log(`
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
//   console.log(color.dim('tasks'), '\t\t', color.bold(task.toUpperCase()))
//   console.log('\t\t', color.bold(target))
//
//   const targets = target.toLowerCase().split(',')
//   if (targets.length) {
//     job.projects = targets.map(getProject)
//   } else {
//     job.projects.push(getProject(target))
//   }
//
//   async function runPipeLine() {
//     for (const t of job.pipeLine) {
//       Log(color.bold( t.name), )
//       if (t.isCommit) {
//         await git.commit(task == 'commit' ? process.argv[3] : false)
//       } else {
//         await Promise.all(job.projects.map(t))
//       }
//     }
//   }
//
//   await runPipeLine()
//   Log(color.bold('Complete'))
// })
