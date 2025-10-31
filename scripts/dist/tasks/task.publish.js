import { FileLog } from '../log';
import { exec } from 'child_process';
export async function publish(project) {
    const log = FileLog('publish:' + project.packageJson.name);
    // project.savePackageJsonTo.artifacts()
    // project.savePackageJsonTo.source()
    const cmd = 'npm publish --access public';
    // log('run ' )
    // return
    exec(cmd, {
        cwd: project.artPatch,
    }, (error, stdout, std) => {
        if (error) {
            log.error(`\n${error.message}`);
            return;
        }
        if (std) {
            log.warn(`${std}`);
        }
        log(`complete\n`, stdout);
    });
}
//# sourceMappingURL=task.publish.js.map