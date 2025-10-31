import { FileLog, Log } from '~/scripts/log';
import { versions } from '~/scripts/now';
export async function upver(project) {
    const log = FileLog(project.packageJson.name + ' version');
    const v = project.packageJson.version;
    const parts = v.split('.');
    let build = parseInt(parts.pop());
    // @ts-ignore
    build++;
    if (isNaN(build)) {
        Log.error(build + 'build is Not A Number');
        Log.error('wrong version number', parts);
        throw 'wrong version number';
    }
    parts.push(build.toString());
    const nv = parts.join('.');
    log('set version', nv);
    project.packageJson.version = nv;
    versions[project.packageJson.name] = nv;
    project.savePackageJsonTo.source();
}
//# sourceMappingURL=task.upver.js.map