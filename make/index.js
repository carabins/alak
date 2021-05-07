require('ts-node').register({
  transpileOnly: true,
})
const task = process.argv[2]
const libName = process.argv[3]
const { executeCommand } = require('./helpers')
const chokidar = require('chokidar')

console.log('task:', task)
console.log('name:', libName)

switch (task) {
  case 'dev':
    let t
    let p
    chokidar.watch(['./make/', './packages']).on('all', (event, path) => {
      clearInterval(t)
      t = setTimeout(() => {
        executeCommand('node make play')
      }, 24)
    })
    break
  case 'publish':
    console.log('publish')
    require('./publish').publish(libName)
    break
  case 'play':
    console.log('play')
    require('./dev-play')
    break
  default:
    require('./make-lib').lib(libName)
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
