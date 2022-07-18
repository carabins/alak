import fs from 'fs'
import path from 'path'
import { Worker } from 'node:worker_threads'

const TSR = require('tap-mocha-reporter')
const chokidar = require('chokidar')

console.clear()

export function testAll(projectName) {
  const testDir = path.resolve('packages', projectName, 'test')
  if (fs.existsSync(testDir)) {
    // console.log('test', projectName)
    fs.readdirSync(testDir).forEach((testfile) => {
      // console.log('run', testfile)
      runTest(path.join(testDir, testfile))
    })
  }
}
export function runTest(testFile) {
  try {
    const worker = new Worker(testFile, {
      stdout: true,
      stderr: true,
      stdin: true,
    })
    // worker.stdout.pipe(process.stdout)
    worker.stderr.pipe(process.stdout)
    worker.stdout.pipe(TSR('classic'))
    // worker.on('exit', (fall) => {
    //   fall && console.log('FALL', testFile)
    // })
  } catch (e){
    console.log("worker error")
  }
}

fs.readdirSync('packages').forEach(testAll)
