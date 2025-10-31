import * as ts from 'typescript';
import { createCompilerHost, createProgram, ModuleKind, ModuleResolutionKind, ScriptTarget, } from 'typescript';
import { FileLog } from '~/scripts/log';
import { scanAllSrc } from '~/scripts/common/scan';
import { Const } from '~/scripts/common/constants';
import path from 'path';
import * as fs from 'fs-extra';
const state = {
    sources: {},
    ready: false,
    declarations: {},
};
const tsconfig = fs.readJSONSync('tsconfig.json');
export async function runTsc() {
    const log = FileLog('tsc');
    if (state.ready) {
        return state;
    }
    log('reading sources...');
    await new Promise((done) => setTimeout(done, 60));
    return new Promise((done) => {
        state.sources = scanAllSrc();
        Object.keys(state.sources.projects).forEach((p) => {
            state.declarations[p] = [];
        });
        log('compile declarations...');
        const tscOptions = {
            allowJs: true,
            declaration: true,
            emitDeclarationOnly: true,
            outDir: Const.ARTIFACTS,
            module: ModuleKind.NodeNext,
            moduleResolution: ModuleResolutionKind.NodeNext,
            target: ScriptTarget.ESNext,
            skipLibCheck: true,
            baseUrl: '.',
            paths: tsconfig.compilerOptions.paths,
        };
        const host = createCompilerHost(tscOptions);
        host.writeFile = (outFile, content, b, a, z) => {
            const srcFile = z[0].fileName;
            const parts = srcFile.split('/').slice(-3);
            const project = parts[0];
            const outName = parts[2];
            if (!state.declarations[project]) {
                state.declarations[project] = [];
            }
            state.declarations[project].push({
                outFile: path.resolve(Const.ARTIFACTS, project, outName.replace('.ts', '.d.ts')),
                content,
            });
        };
        const program = createProgram(state.sources.all, tscOptions, host);
        const emitResult = program.emit();
        let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        allDiagnostics.forEach((diagnostic) => {
            if (diagnostic.file) {
                let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
                let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                // Skip errors for @alaq/* module imports (TS2307) - these are handled by path aliases at runtime
                if (diagnostic.code === 2307 && message.includes('@alaq/')) {
                    log.warn(`Ignoring module resolution error: ${message}`);
                    return;
                }
                console.log(`
(╯°□°)╯︵ ${message}
`);
                log.error(`${diagnostic.file.fileName} (${line + 1},${character + 1})`);
                log.error(`ts.getPreEmitDiagnostics`);
                process.exit();
            }
            else {
                log.warn(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
            }
        });
        state.ready = true;
        done(state);
    });
}
//# sourceMappingURL=tsc.js.map