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
  let totalSizeCjs = 0
  let totalSizeEsm = 0

  // Helper function to fix ESM imports - convert path aliases to relative paths
  const fixEsmImports = (code: string, packageDir: string, packageName: string): string => {
    // 1. Replace internal package aliases (e.g., 'alak/namespaces' -> './namespaces.mjs')
    code = code.replace(
      new RegExp(`(['"])${packageDir}/([^'"]+)(['"])`, 'g'),
      "$1./$2.mjs$3"
    )

    // 2. Replace @alaq self-imports with relative paths (e.g., '@alaq/nucleus/bus' -> './bus.mjs' in nucleus package)
    const selfImportRegex = new RegExp(`(['"])${packageName}/([^'"]+)(['"])`, 'g')
    code = code.replace(
      selfImportRegex,
      "$1./$2.mjs$3"
    )

    // 3. Replace other @alaq package imports to include .mjs extension
    code = code.replace(
      /(['"])(@alaq\/[^'"]+)(['"])/g,
      (match, quote1, importPath, quote2) => {
        // Only add .mjs if there's no extension already
        if (!importPath.endsWith('.mjs') && !importPath.endsWith('.js')) {
          return `${quote1}${importPath}.mjs${quote2}`
        }
        return match
      }
    )

    // 4. Add .mjs to relative imports without extension (e.g., './unionAtom' -> './unionAtom.mjs')
    code = code.replace(
      /(['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, quote1, importPath, quote2) => {
        // Skip if already has extension
        if (importPath.endsWith('.mjs') || importPath.endsWith('.js') || importPath.endsWith('.json')) {
          return match
        }
        return `${quote1}${importPath}.mjs${quote2}`
      }
    )

    return code
  }

  Object.keys(srcFiles).forEach((srcFile) => {
    const src = srcFiles[srcFile]
    if (!src.isDeclaration) {
      const sourceCode = readFileSync(srcFile).toString()

      // Generate CommonJS version (.js)
      const cjs = transformSync(sourceCode, src.name, {
        module: 'commonjs',
        sourcemap: false,
      })
      totalSizeCjs += cjs.code.length
      writeFileSync(path.join(project.artPatch, src.name + '.js'), cjs.code)

      // Generate ESM version (.mjs)
      const esm = transformSync(sourceCode, src.name, {
        module: 'es6',
        sourcemap: false,
      })

      // Fix ESM imports to use relative paths with .mjs extension
      const esmCodeFixed = fixEsmImports(esm.code, project.dir, project.packageJson.name as string)

      totalSizeEsm += esmCodeFixed.length
      writeFileSync(path.join(project.artPatch, src.name + '.mjs'), esmCodeFixed)
    }
  })

  log('unminified CJS size:', (totalSizeCjs / 1024).toFixed(2), 'kb')
  log('unminified ESM size:', (totalSizeEsm / 1024).toFixed(2), 'kb')
  project.packageJson.license = 'TVR'
  fs.copyFileSync('LICENSE', path.resolve(project.artPatch, 'LICENSE'))
  //project.savePackageJsonTo.art()
  log('complete')
}
