//@ts-ignore
import fg from 'fast-glob'
import { getFileNames, updateIfNew } from './tools'
import * as path from 'path'
import { headStamp } from './headstamp'

export function createIndexUpdater(outDir: string) {
  return async () => {
    const files = await fg(outDir + '/*')
    return new Promise((done) => {
      const modules = getFileNames(
        files.filter((f) => !f.endsWith('.d.ts')).filter((f) => f.indexOf('index') === -1),
      )
      const template = `${headStamp}

${modules.map((n) => 'import ' + n + ' from "./' + n + '";').join('\n')}
export function installAlakVue(app){
    ${modules.map((n) => n + '(app)').join('\n\t')}
}
`
      updateIfNew(path.resolve(outDir, 'index.ts'), template)
      done(true)
    })
  }
}
