import { FileLog } from '~/scripts/log';
import { versions } from '~/scripts/now';
export async function syncDeps(project) {
    const log = FileLog('sync ' + project.dir);
    const deps = project.packageJson.dependencies;
    deps &&
        Object.keys(deps).forEach((name) => {
            const nowVersion = versions[name];
            if (nowVersion && deps[name] != nowVersion) {
                log(`up ${name} to ${nowVersion}`);
                deps[name] = nowVersion;
            }
        });
}
//# sourceMappingURL=task.syncDeps.js.map