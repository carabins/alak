import { fork } from 'child_process'
import { clearLib, tsc } from './tsc'
import { executeCommand } from './helpers'

const forked = []
const runTests = () => {
  while (forked.length) forked.pop().kill()
  console.clear()
  forked.push(fork('node_modules/jest/bin/jest'))
}

export async function dev() {
  var nodemon
  try {
    nodemon = require('nodemon')
  } catch (e) {
    await executeCommand(`npm i nodemon --no-save`, '.')
    nodemon = require('nodemon')
  }
  nodemon({
    ext: 'js',
    watch: 'tests',
  })
  nodemon
    .on('start', () => {
      clearLib()
      tsc().then(runTests)
    })
    .on('restart', function (files) {
      console.log('Tests restarted : ', files)
      fork('node_modules/jest/bin/jest')
    })
}

// export function run() {
//   fork('node_modules/jest/bin/jest')
// }
