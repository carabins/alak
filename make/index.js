require('ts-node').register()
const task = process.argv[2]

const { executeCommand } = require('./helpers')
const chokidar = require('chokidar')

console.log('make')

switch (task) {
  case 'dev':
    let t
    let p
    console.log('dev script?')
    chokidar.watch('./make/').on('all', (event, path) => {
      clearInterval(t)
      t = setTimeout(() => {
        console.log(__dirname)
        executeCommand('node ./make')
      }, 24)
    })
    break
  default:
    console.log('make lib')
    require('./make-lib').lib()
    break
  // case 'doc':
  // case 'docs':
  //   require('./scripts/make-docs')
  //   break
  // case 'lib':
  //   require('./scripts/make-lib').lib()
  //   break
  // case 'dev':
  //   require('./scripts/dev-play')
  //   break
  // case 'site':
  //   require('./scripts/make-site')
  //   break
  // case 'pub':
  // case 'publish':
  //   require('./scripts/publish')
  //   break
  // case 'clean':
  //   require('./scripts/tsc').clearLib()
  //   break
  // case 'play':
  //   require('./playground/')
  //   break
  // case 'dt':
  //   require('./scripts/dev-tests').dev()
  //   break
  // case 'test':
  // case 'tests':
  //   require('./scripts/dev-tests').run()
  //   break
}
