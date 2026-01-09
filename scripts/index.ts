import select from '@inquirer/select'
import checkbox from '@inquirer/checkbox'
import { packagesSets } from '~/scripts/config.projects'
import { taskPipelines } from '~/scripts/config.pipes'
import { packageRegistry } from '~/scripts/common/scan.projects'
import { Log } from '~/scripts/log'
import { initExecutor } from '~/scripts/common/executor.init'

async function main() {
  const executor = await initExecutor()

  const cmd = process.argv[2]
  const target = process.argv[3]

  if (cmd) {
    const pipeline = taskPipelines[cmd]
    if (!pipeline) {
      Log.error(`Task '${cmd}' not found available: ${Object.keys(taskPipelines).join(', ')}`)
      process.exit(1)
    }

    let targets: string[] = []

    if (target) {
      if (packagesSets[target]) {
        const set = packagesSets[target]
        const v = typeof set.get === 'function' ? await set.get() : set.get
        targets = Array.isArray(v) ? v : [v]
      } else if (packageRegistry.all[target]) {
        targets = [target]
      } else {
        Log.error(`Target '${target}' not found`)
        process.exit(1)
      }
    } else {
      Log.error('Target package/set required')
      process.exit(1)
    }

    await executor.runPipe(pipeline, targets)
    return
  }

  console.clear()

  const setKey = await select({
    message: '📦 Select project set:',
    choices: Object.entries(packagesSets).map(([k, v]) => ({
      name: v.name,
      description: v.desc,
      value: k,
    })),
  })

  const set = packagesSets[setKey]

  let targets: string[] = []
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

async function selectCustomProjects(): Promise<string[]> {
  return await checkbox({
    message: 'Select packages:',
    choices: Object.values(packageRegistry.all).map((p) => ({
      name: p.packageJson.name,
      description: p.packageJson.description,
      value: p.id,
    })),
    pageSize: 10,
  })
}

main()
