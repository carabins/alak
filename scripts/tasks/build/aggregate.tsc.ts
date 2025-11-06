import * as ts from 'typescript'
import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  ModuleKind,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript'

import {scanAllSrc} from '~/scripts/common/scan.files'
import {Const} from '~/scripts/common/constants'
import path from 'path'
import * as fs from 'fs-extra'
import {createModuleLogger} from '~/scripts/log'
import {BuildPackage} from '~/scripts/BuildPackage'

const state = {
  sources: {} as any,
  ready: false,
  declarations: {} as Record<string, any>,
}

const tsconfig = fs.readJSONSync('tsconfig.json')
export default async function (projects: BuildPackage[]): Promise<typeof state> {
  const log = createModuleLogger('tsc')
  if (state.ready) {
    return state
  }

  log('reading sources...')
  for (const project of projects) {
    fs.copySync(path.join(project.packagePath, "src"), path.join(project.artPatch, "types"), {
      filter: (src) => {
        const stat = fs.statSync(src)
        if (stat.isDirectory()) return true
        return src.endsWith('.d.ts')
      },
    })
  }
  return new Promise((done) => {
    state.sources = scanAllSrc(projects)
    Object.keys(state.sources.projects).forEach((p) => {
      state.declarations[p] = []
    })

    const tscOptions: CompilerOptions = {
      declaration: true,
      emitDeclarationOnly: true,
      outDir: Const.ARTIFACTS,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Node10,
      target: ScriptTarget.ESNext,
      skipLibCheck: true,
      baseUrl: '.',
      paths: tsconfig.compilerOptions.paths,
    }

    // Компилируем каждый пакет отдельно в правильном порядке
    for (const project of projects) {
      const projectSources = Object.keys(state.sources.projects[project.id] || {})
      if (!projectSources.length) continue

      log(`${project.id}`)

      const host = createCompilerHost(tscOptions)
      host.writeFile = (outFile, content, b, a, z) => {
        const srcFile = z[0].fileName
        const normalized = path.normalize(srcFile)
        const parts = normalized.split(path.sep)

        const pkgIdx = parts.indexOf('packages')
        if (pkgIdx === -1) return

        const pkg = parts[pkgIdx + 1]
        const srcIdx = parts.indexOf('src', pkgIdx)
        const typesIdx = parts.indexOf('types', pkgIdx)

        let relPath
        if (srcIdx !== -1) {
          relPath = parts.slice(srcIdx + 1).join(path.sep)
        } else if (typesIdx !== -1) {
          relPath = parts.slice(typesIdx + 1).join(path.sep)
        } else {
          return
        }

        const outPath = path.resolve(Const.ARTIFACTS, pkg, "types", relPath.replace('.ts', '.d.ts'))
        const outDir = path.dirname(outPath)

        if (!state.declarations[pkg]) {
          state.declarations[pkg] = []
        }

        fs.ensureDirSync(outDir)
        fs.writeFileSync(outPath, content)
      }

      const program = createProgram(projectSources, tscOptions, host)
      const emitResult = program.emit()
      let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

      allDiagnostics.forEach((diagnostic) => {
        if (diagnostic.file) {
          let {line, character} = ts.getLineAndCharacterOfPosition(
            diagnostic.file,
            diagnostic.start!,
          )
          let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

          console.log(`
(╯°□°)╯︵ ${message}
`)
          log.error(`${diagnostic.file.fileName} (${line + 1},${character + 1})`)
          log.error(`ts.getPreEmitDiagnostics`)

          process.exit()
        } else {
          log.warn(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
        }
      })
    }

    state.ready = true
    done(state)
  })
}
