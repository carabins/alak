import { initExecutor } from './common/executor.init'
import { taskPipelines } from './config.pipes'
import { Log } from './log'

async function run() {
  const executor = await initExecutor()
  const targets = ['alak', 'atom', 'nucleus']
  const pipeline = taskPipelines['art']
  
  if (!pipeline) {
    console.error('Pipeline "art" not found')
    process.exit(1)
  }

  Log.info(`Running pipeline "${pipeline.name}" for targets: ${targets.join(', ')}`)
  const result = await executor.runPipe(pipeline, targets)
  
  if (!result.success) {
    console.error('Build failed')
    process.exit(1)
  }
}

run()
