import select from '@inquirer/select'
import checkbox from '@inquirer/checkbox'
import { packagesSets } from '~/scripts/config.projects'
import { taskPipelines } from '~/scripts/config.pipes'
import { packageRegistry } from '~/scripts/common/scan.projects'
import { BuildPackage } from '~/scripts/BuildPackage'
import { Log } from '~/scripts/log'
import { initExecutor } from '~/scripts/common/executor.init'

async function main() {
  console.clear()

  const executor = await initExecutor()

  const cmd = process.argv[2]

  // ========== МЕНЮ 1: Выбор пакетов ==========
  const setKey = await select({
    message: '📦 Select project set:',
    choices: Object.entries(packagesSets).map(([k, v]) => ({
      name: v.name,
      description: v.desc,
      value: k,
    })),
  })

  const set = packagesSets[setKey]

  let targets = []
  if (set.interactive) {
    targets = await selectCustomProjects()
  } else {
    if (typeof set.get === 'function') {
      const v = await set.get()
      targets.push(...v)
    } else {
      targets.push(...set.get)
    }
  }

  if (!targets?.length) {
    Log.error('Проекты не выбраны')
    return
  }

  // ========== МЕНЮ 2: Выбор задачи ==========
  const pipeKey = await select({
    message: '🚀 Select task:',
    choices: Object.entries(taskPipelines).map(([k, v]) => ({
      name: v.name,
      description: v.desc,
      value: k,
    })),
  })

  await executor.runPipe(taskPipelines[pipeKey], targets)
}

async function selectCustomProjects(): Promise<BuildPackage[]> {
  return await checkbox({
    message: 'Select packages:',
    choices: Object.values(packageRegistry.all).map((p) => ({
      name: p.packageJson.name,
      description: p.packageJson.description,
      value: p,
    })),
    pageSize: 10,
  })
}

main()
