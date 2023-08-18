import fs from 'fs'
import chokidar from 'chokidar'
import { exec } from 'child_process'
import * as color from 'colorette'
import path from "path";

const projects = {}
fs.readdirSync('packages').forEach((p) => (projects[p] = true))

const marked = {}
const TSR = require('tap-mocha-reporter')

console.log(color.red('dev starts'))
function run(f) {
  console.log(color.blueBright(f))
  const p = exec('ts-node-dev --transpile-only --quiet --rs -r tsconfig-paths/register ' + f)
  // p.stdout = process.stdout
  p.stdout.pipe(TSR('classic'))
  // p.stdout.pipe(process.stdout)
  p.stderr.pipe(process.stdout)
}

chokidar.watch('packages').on('change', (target) => {
  const [pak, project, ctx, file] = target.split(path.sep)
  console.log(project, ctx)
  if (projects[project]) {
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
        console.log({ target })
        run(target)
    }
  }
})
