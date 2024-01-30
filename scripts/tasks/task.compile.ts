import { Project } from '../common/project'
import { FileLog } from '../log'
import * as path from 'path'
import * as fs from 'fs-extra'
import { runTsc } from '~/scripts/common/tsc'
import { readFileSync, writeFileSync } from 'fs'
import { transformSync } from '@swc-node/core'

const tscState = {
  promise: undefined,
  result: undefined,
}

function tsc() {
  if (tscState.promise) {
    return tscState.promise
  }
  if (tscState.result) {
    return tscState.result
  }
  return (tscState.promise = runTsc().then((r) => {
    tscState.result = r
  }))
}

export async function compile(project: Project) {
  const log = FileLog(project.packageJson.name + ' compiler')
  log('prepare...')
  await tsc()
  const { sources, declarations } = tscState.result

  fs.existsSync(project.artPatch) && fs.removeSync(project.artPatch)
  fs.mkdirpSync(project.artPatch)

  log('write...')
  declarations[project.dir].forEach(({ outFile, content }) => {
    if (outFile.endsWith('index.d.ts')) {
      content = `/// <reference path="types.d.ts" />\n` + content
    }
    writeFileSync(outFile, content)
  })

  const declarationsPath = project.resolveInPackage('types')
  const declarationsMix = fs.existsSync(declarationsPath)
  if (declarationsMix) {
    let declarationSource = ''
    log('mixin declarations...')
    fs.readdirSync(declarationsPath).forEach((f) => {
      declarationSource += fs.readFileSync(path.resolve(declarationsPath, f))
    })
    const refs = []
    project.packageJson?.dependencies &&
      Object.keys(project.packageJson?.dependencies).forEach((p) => {
        const d = p.replace('@alaq/', '')
        refs.push(`/// <reference path="../${d}/types.d.ts" />`)
      })
    if (refs.length) {
      declarationSource = [...refs, declarationSource].join('\n')
    }
    fs.writeFileSync(path.join(project.artPatch, 'types.d.ts'), declarationSource)

    // fs.appendFileSync(
    //   path.join(project.artPatch, 'index.d.ts'),
    //   declarationSource
    //     .replaceAll('type', 'export type')
    //     .replaceAll('interface', 'export interface'),
    // )
    // declarationSource = ''
  }

  const srcFiles = sources.projects[project.dir]
  let totalSize = 0
  Object.keys(srcFiles).forEach((srcFile) => {
    const src = srcFiles[srcFile]
    if (!src.isDeclaration) {
      const Z = transformSync(readFileSync(srcFile).toString(), src.name, {
        module: 'commonjs',
        sourcemap: false,
        // paths: tsconfig.compilerOptions.paths
      })
      // console.log(srcFile, Z.code.length)
      totalSize += Z.code.length
      writeFileSync(path.join(project.artPatch, src.name + '.js'), Z.code)
    }
  })
  log('unminified source size', (totalSize / 1024).toFixed(2), 'kb')
  project.packageJson.license = 'TVR'
  fs.copyFileSync('LICENSE', path.resolve(project.artPatch, 'LICENSE'))
  project.savePackageJsonTo.art()
  log('complete')
}
