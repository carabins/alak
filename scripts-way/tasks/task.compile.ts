import { Project } from '../common/project'
import { FileLog } from '../log'
import * as path from 'path'
import * as fs from 'fs-extra'
import { runTsc } from '~/scripts/common/tsc'
import { readFileSync, writeFileSync } from 'fs'
import { transform } from 'oxc-transform'

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

    // Copy types folder to artifacts
    const artTypesPath = path.join(project.artPatch, 'types')
    fs.mkdirpSync(artTypesPath)

    fs.readdirSync(declarationsPath).forEach((f) => {
      const sourceContent = fs.readFileSync(path.resolve(declarationsPath, f))
      declarationSource += sourceContent

      // Copy individual .d.ts file to artifacts/types/
      fs.copyFileSync(
        path.resolve(declarationsPath, f),
        path.join(artTypesPath, f)
      )
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

      // Generate CommonJS version (.js) using oxc-transform
      const cjsResult = transform(src.name + '.ts', sourceCode, {
        lang: 'ts',
        target: 'es2015',
      })

      if (cjsResult.errors && cjsResult.errors.length > 0) {
        log.error(`Errors in ${src.name}:`, cjsResult.errors)
      }

      // Note: oxc-transform outputs ESM by default, we'll need to convert to CJS manually
      let cjsCode = cjsResult.code

      // ESM to CJS conversion
      // Process line by line to avoid regex issues
      const lines = cjsCode.split('\n')
      const cjsLines = []

      for (let line of lines) {
        // Handle imports
        if (line.match(/^import\s+\{[^}]+\}\s+from/)) {
          // import { x, y } from 'z' -> const { x, y } = require('z')
          line = line.replace(/^import\s+(\{[^}]+\})\s+from\s+(['"][^'"]+['"])/, 'const $1 = require($2)')
        } else if (line.match(/^import\s+\*\s+as\s+\w+\s+from/)) {
          // import * as x from 'y' -> const x = require('y')
          line = line.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+(['"][^'"]+['"])/, 'const $1 = require($2)')
        } else if (line.match(/^import\s+\w+\s+from/)) {
          // import x from 'y' -> const x = require('y')
          line = line.replace(/^import\s+(\w+)\s+from\s+(['"][^'"]+['"])/, 'const $1 = require($2)')
        }

        // Handle exports
        if (line.match(/^export\s+\{[^}]+\}\s+from/)) {
          // export { x } from 'y' -> const { x } = require('y'); exports.x = x
          const match = line.match(/^export\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"])/)
          if (match) {
            const names = match[1].split(',').map(n => n.trim())
            cjsLines.push(`const { ${match[1]} } = require(${match[2]})`)
            names.forEach(name => {
              cjsLines.push(`exports.${name} = ${name};`)
            })
            continue
          }
        } else if (line.match(/^export\s+(const|let|var|function|class)\s+/)) {
          // export const x = 1 -> const x = 1; exports.x = x
          const match = line.match(/^export\s+(const|let|var|function|class)\s+(\w+)/)
          if (match) {
            line = line.replace(/^export\s+/, '')
            cjsLines.push(line)
            cjsLines.push(`exports.${match[2]} = ${match[2]};`)
            continue
          }
        } else if (line.match(/^export\s+default\s+/)) {
          // export default x -> exports.default = x
          line = line.replace(/^export\s+default\s+/, 'exports.default = ')
        } else if (line.match(/^export\s+\{[^}]+\}/)) {
          // export { x, y } -> exports.x = x; exports.y = y
          const match = line.match(/^export\s+\{([^}]+)\}/)
          if (match) {
            const names = match[1].split(',').map(n => n.trim())
            names.forEach(name => {
              cjsLines.push(`exports.${name} = ${name};`)
            })
            continue
          }
        }

        cjsLines.push(line)
      }

      cjsCode = cjsLines.join('\n')

      totalSizeCjs += cjsCode.length
      writeFileSync(path.join(project.artPatch, src.name + '.js'), cjsCode)

      // Generate ESM version (.mjs)
      const esmCode = cjsResult.code  // oxc-transform outputs ESM by default

      // Fix ESM imports to use relative paths with .mjs extension
      const esmCodeFixed = fixEsmImports(esmCode, project.dir, project.packageJson.name as string)

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
