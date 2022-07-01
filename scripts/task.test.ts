const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads')
import { Project } from './common/project'
import * as path from 'path'
import * as fs from 'fs'
import { FileLog } from './log'

export async function test(project: Project) {
  const testDir = path.resolve(project.packagePath, 'test')
  const trace = FileLog('test:' + project.dir)
  if (!fs.existsSync(testDir)) {
    trace.warn('not implemented')
    return await Promise.resolve()
  }

  const pool = []
  trace('starting...')
  const files = {}
  fs.readdirSync(testDir).forEach((f) => {
    pool.push(
      new Promise((resolve, reject) => {
        trace.info('+', f)
        const worker = new Worker(`./packages/${project.dir}/test/${f}`, {
          stdout: true,
          // stderr: true,
          // stdin: true
        })
        files[f] = 'start'
        let chunks = ''
        worker.stdout.on('data', (chunk) => {
          chunks += chunk.toString()
        })

        // worker.on('message', (...e) => trace.error("e", e))
        // worker.on('error', (...e) => trace.error("e", e))
        worker.on('exit', (fall) => {
          trace('exit', f)
          if (fall) {
            trace.error(f, 'FALL')
            // console.log(chunks)
            // console.log(worker.stderr.read())
            files[f] = 'fall'
            reject(false)
          } else {
            files[f] = 'done'
            resolve(true)
          }
        })
      }),
    )
  })
  const result = await Promise.all(pool)
  const fine = result.filter((v) => !v).length === 0
  if (fine) {
    trace.info('all tests PASS')
    return true
  } else {
    trace.error(files)
    return false
  }
}
