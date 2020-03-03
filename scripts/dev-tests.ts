import { fork } from 'child_process'
import { tsc } from './make-lib'

var nodemon = require('nodemon')

nodemon({
  ext: 'js',
  watch: 'tests',
})

const forked = []
const runTests = () => {
  while (forked.length) forked.pop().kill()
  console.clear()
  forked.push(fork('node_modules/jest/bin/jest'))
}

nodemon
  .on('start', () => tsc().then(runTests))
  .on('restart', function(files) {
    console.log('Tests restarted : ', files)
    fork('node_modules/jest/bin/jest')
  })