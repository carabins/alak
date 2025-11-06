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
import {createModuleLogger} from "~/scripts/log";
import {BuildPackage} from "~/scripts/BuildPackage";

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
  // await new Promise((done) => setTimeout(done, 60))
  return new Promise((done) => {
    console.info('running sources...', Object.keys(projects))
    state.sources = scanAllSrc(projects)
    Object.keys(state.sources.projects).forEach((p) => {
      state.declarations[p] = []
    })

    log('compile declarations...')
    const tscOptions: CompilerOptions = {
      allowJs: true,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: Const.ARTIFACTS,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      target: ScriptTarget.ESNext,
      skipLibCheck: true,
      baseUrl: '.',
      paths: tsconfig.compilerOptions.paths,
    }
    const host = createCompilerHost(tscOptions)
    host.writeFile = (outFile, content, b, a, z) => {
      const srcFile = z[0].fileName
      const normalized = path.normalize(srcFile)
      const parts = normalized.split(path.sep)

      const pkgIdx = parts.indexOf('packages')
      if (pkgIdx === -1) return

      const project = parts[pkgIdx + 1]
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

      const outPath = path.resolve(Const.ARTIFACTS, project, relPath.replace('.ts', '.d.ts'))
      const outDir = path.dirname(outPath)

      if (!state.declarations[project]) {
        state.declarations[project] = []
      }

      fs.ensureDirSync(outDir)
      fs.writeFileSync(outPath, content)
    }
    const program = createProgram(state.sources.all, tscOptions, host)
    const emitResult = program.emit()
    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        let {line, character} = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start!,
        )
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

        // Skip errors for @alaq/* module imports (TS2307) - these are handled by path aliases at runtime
        // if (diagnostic.code === 2307 && message.includes('@alaq/')) {
        //   log.warn(`Ignoring module resolution error: ${message}`)
        //   return
        // }

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

    state.ready = true

    done(state)
  })
}
