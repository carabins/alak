import fs from 'fs'
import chokidar from 'chokidar'
import path from 'path'
import { runTest, testAll } from './index'

const projects = {}
fs.readdirSync('packages').forEach((p) => (projects[p] = true))

chokidar.watch('packages').on('change', (target, ...a) => {
  const [pak, project, ctx, file] = target.split('/')
  if (projects[project]) {
    switch (ctx) {
      case 'src':
        console.clear()
        console.log('reload', project.toUpperCase(), file)
        testAll(project)
        break
      case 'test':
        console.clear()
        console.log('reload', project.toUpperCase(), file)
        runTest(path.resolve(target))
    }
  }
})
