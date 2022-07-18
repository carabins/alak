import {Project} from './common/project'
import {FileLog} from './log'
import * as path from 'path'
import {Const} from './common/constants'
import * as fs from 'fs-extra'
import {scanAllSrc, startScan} from './common/scan'
import * as ts from 'typescript'
import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript'
import {runTsc} from '~/scripts/common/tsc'
import {readFileSync, writeFileSync} from 'fs'
import {transformSync} from '@swc-node/core'

export async function compile(project: Project) {
  const trace = FileLog(project.packageJson.name + ' compiler')
  trace('prepare...')
  const {sources, declarations} = await runTsc()

  fs.existsSync(project.artPatch) && fs.removeSync(project.artPatch)
  fs.mkdirpSync(project.artPatch)

  trace('write...')
  declarations[project.dir].forEach(({outFile, content}) => {
    if (outFile.endsWith("index.d.ts")) {
      content = `/// <reference path="types.d.ts" />\n` + content
    }
    writeFileSync(outFile, content)
  })

  const declarationsPath = project.resolveInPackage('types')
  const declarationsMix = fs.existsSync(declarationsPath)
  if (declarationsMix) {
    let declarationSource = ''
    trace('mixin declarations...')
    fs.readdirSync(declarationsPath).forEach((f) => {
      declarationSource += fs.readFileSync(path.resolve(declarationsPath, f))
    })
    const refs = []
    project.packageJson?.dependencies && Object.keys(project.packageJson?.dependencies).forEach(p => {
      const d = p.replace('@alaq/', '')
      refs.push(`/// <reference path="../${d}/types.d.ts" />`)
    })
    if (refs.length){
      declarationSource = [...refs, declarationSource].join("\n")
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
  trace('unminified source size', (totalSize / 1024).toFixed(2), 'kb')
  fs.copyFileSync('LICENSE', path.resolve(project.artPatch, 'LICENSE'))
  project.savePackageJsonTo.art()
  trace('complete')
}
