import { Project } from './common/project'
import { FileLog } from './log'
import * as path from 'path'
import { Const } from './common/constants'
import * as fs from 'fs-extra'
import { scanAllSrc, startScan } from './common/scan'
import * as ts from 'typescript'
import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript'
import { runTsc } from '~/scripts/common/tsc'
import { readFileSync, writeFileSync } from 'fs'
import { transformSync } from '@swc-node/core'

const tsconfig = fs.readJSONSync('tsconfig.json')

export async function compile(project: Project) {
  const trace = FileLog(project.packageJson.name + ' compiler')
  trace('prepare...')
  const { sources, declarations } = await runTsc()

  fs.existsSync(project.artPatch) && fs.removeSync(project.artPatch)
  fs.mkdirpSync(project.artPatch)

  trace('write...')
  declarations[project.dir].forEach(({ outFile, content }) => {
    writeFileSync(outFile, content)
  })

  const declarationsPath = project.resolveInPackage('types')
  const declarationsMix = fs.existsSync(declarationsPath)
  if (declarationsMix) {
    trace('mixin declarations...')
    const artDeclaration = path.join(project.artPatch, 'index.d.ts')
    fs.readdirSync(declarationsPath).forEach((f) => {
      fs.appendFileSync(artDeclaration, fs.readFileSync(path.resolve(declarationsPath, f)))
    })
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
      totalSize += Z.code.length
      writeFileSync(path.join(project.artPatch, src.name + '.js'), Z.code)
    }
  })
  trace('unminified source size', (totalSize / 1024).toFixed(2), 'kb')
  fs.copyFileSync('LICENSE', path.resolve(project.artPatch, 'LICENSE'))
  trace('complete')
}
