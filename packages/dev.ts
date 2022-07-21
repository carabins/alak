import fs from 'fs'
import chokidar from 'chokidar'
import path from 'path'
import { runTest, testAll } from './index'
import { exec, execSync } from 'child_process'
import { FileLog } from '~/scripts/log'

const projects = {}
fs.readdirSync('packages').forEach((p) => (projects[p] = true))

const marked = {}
const TSR = require('tap-mocha-reporter')
function run(f) {
  const p = exec('node -r @swc-node/register -r tsconfig-paths/register ' + f)
  // p.stdout = process.stdout
  p.stdout.pipe(TSR('classic'))
  p.stderr.pipe(process.stdout)
}
chokidar.watch('packages').on('change', (target, ...a) => {
  const [pak, project, ctx, file] = target.split('/')
  if (projects[project]) {
    console.clear()
    console.log(target)
    switch (ctx) {
      case 'src':
        const testFiles = Object.keys(marked)
        if (!testFiles.length) {
          console.warn('no tests started')
        } else {
          testFiles.forEach(run)
        }
        break
      case 'test':
        marked[target] = true
        run(target)
    }
  }
})
