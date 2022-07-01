import {
  CompilerOptions,
  createCompilerHost,
  createProgram,
  ModuleResolutionKind,
  ScriptTarget,
} from 'typescript'
import * as ts from 'typescript'
import { FileLog } from '~/scripts/log'
import { scanAllSrc } from '~/scripts/common/scan'
import { Const } from '~/scripts/common/constants'
import path from 'path'

const state = {
  sources: {} as UnpackedFlow<typeof scanAllSrc>,
  ready: false,
  declarations: {} as KV<any>,
}

export async function runTsc(): Promise<typeof state> {
  const trace = FileLog('tsc')
  if (state.ready) {
    return state
  }

  trace('reading sources...')
  await new Promise((done) => setTimeout(done, 60))
  return new Promise((done) => {
    state.sources = scanAllSrc()
    Object.keys(state.sources.projects).forEach((p) => {
      state.declarations[p] = []
    })

    trace('compile declarations...')
    const tscOptions: CompilerOptions = {
      allowJs: true,
      declaration: true,
      emitDeclarationOnly: true,
      outDir: Const.ARTIFACTS,
      moduleResolution: ModuleResolutionKind.NodeNext,
      target: ScriptTarget.ESNext,
      baseUrl: '.',
      paths: {
        'alak/*': ['packages/atom/src/*'],
        '@alaq/molecule/*': ['packages/molecule/src/*'],
      },
    }
    const host = createCompilerHost(tscOptions)
    host.writeFile = (outFile, content, b, a, z) => {
      const srcFile = z[0].fileName
      const parts = srcFile.split('/').slice(-3)
      const project = parts[0]
      const outName = parts[2]
      state.declarations[project].push({
        outFile: path.resolve(Const.ARTIFACTS, project, outName.replace('.ts', '.d.ts')),
        content,
      })
    }

    const program = createProgram(state.sources.all, tscOptions, host)
    const emitResult = program.emit()
    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
    allDiagnostics.forEach((diagnostic) => {
      if (diagnostic.file) {
        let { line, character } = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start!,
        )
        let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        trace.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
        throw 'compile declarations fail'
      } else {
        trace.warn(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
      }
    })

    state.ready = true

    done(state)
  })
}
