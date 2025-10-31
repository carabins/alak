import { Project } from '../common/project'
import * as path from 'path'
import * as fs from 'fs'
import { FileLog, Log } from '../log'
import { exec, spawn } from 'child_process'

import { bench } from '~/scripts/common/bench'

import * as process from 'process'

const { Parser } = require('tap-parser')

export async function devTestFile(f, project, trace) {
  const id = f.replace('.test.ts', '')
  const fp = `./packages/${project.dir}/test/${f}`
  return new Promise((done) => {
    const child = spawn('bun', [fp], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    })
    const p = new Parser((results) => {
      trace.debug(results.time)
      if (results.failures) {
        results.failures.forEach((fall) => {
          trace.error(
            project.dir + ':' + f,
            ' | line:' + fall.diag.at.lineNumber,
            fall.diag.at.columnNumber,
          )
          trace.trace('test name:', fall.name + '\n', fall.diag.source)
        })
      }
      if (results.ok) {
        trace.info(project.dir + ':' + id, 'OK', results.count + '/' + results.pass)
      } else {
        trace.warn(project.dir + ':' + f, 'FALL', results.count + '/' + results.pass)
      }
    })
    child.stdout.pipe(p)
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.on('exit', done)
  })
}

export async function testFileWorker(f, project, log) {
  return new Promise((resolve, reject) => {
    const id = f.replace('.test.ts', '')
    const fp = `./packages/${project.dir}/test/${f}`

    const child = spawn('bun', [fp], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    })

    let hasErrors = false

    child.stderr.on('data', (chunk) => {
      log.warn(id + ' : ' + chunk.toString())
      hasErrors = true
    })

    child.stdout.on('data', (chunk) => {
      // Capture test output to check for failures
      const output = chunk.toString()
      if (output.includes('FAIL') || output.includes('✖')) {
        hasErrors = true
      }
    })

    child.on('error', (error) => {
      log.error(id, error.message)
      hasErrors = true
    })

    child.on('exit', (code) => {
      if (code === 0 && !hasErrors) {
        resolve(false)
        log.trace('PASS', id)
      } else {
        resolve(fp)
        log.error('FAIL', id)
      }
    })
  })
}

export const coverageTest = () =>
  new Promise(async (done) => {
    const t = Date.now()
    Log.info('Full testing...')
    // const process =  spawn(`node`, 'node_modules/tap/dist/esm/run.mjs -R min  --disable-coverage ./packages/*/test/*.test.ts'.split(" "))
    // const process = exec(`tap -b -R min  --disable-coverage ./packages/*/test/*.test.ts`)
    const child = exec(`tap -R min --coverage-report=html ./packages/*/test/*.test.ts`, {})

    const chinks = []
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
    child.stdout.on('data', (data) => {
      chinks.push(data)
    })
    child.stderr.on('error', (data) => {
      Log.error(data)
    })
    child.on('exit', (stdio) => {
      Log.trace('All tests complete in ', Date.now() - t)
      if (chinks.length > 1) {
        chinks.shift()
        Log.error(chinks.join('\n'))

        done(true)
      } else {
        Log.info('All tests passed successfully')
        done(true)
      }
      done(true)
    })
    child.on('error', (stdio) => {
      // console.log("error", stdio)
      Log.error('error ', Date.now() - t)
      // done(true)
    })
  })

async function test(project: Project) {
  const testDir = path.resolve(project.packagePath, 'test')
  const log = FileLog('test:' + project.dir)
  if (!fs.existsSync(testDir)) {
    log.warn('not implemented')
    return await Promise.resolve()
  }
  const pool = []
  fs.readdirSync(testDir)
    .filter((f) => f.endsWith('.test.ts'))
    .forEach((f) => {
      pool.push(testFileWorker(f, project, log))
    })
  return Promise.all(pool)
}

export async function testProjects(projects: Project[]) {
  const b = bench()
  const results = await Promise.all(projects.map(test))
  const falls = results.flat().filter((f) => !!f)
  Log.info('Test complete at ' + b())
  if (falls.length) {
    Log.error('FALL', '\n' + falls.join('\n'))
  } else {
    Log.info('DONE')
  }
}
