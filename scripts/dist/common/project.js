import { Const } from './constants';
import * as path from 'path';
import * as fs from 'fs';
import { copyFileSync, writeFileSync } from 'fs';
import { FileLog } from '../log';
function pick(obj, ...keys) {
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
export function initProject(dir) {
    const log = FileLog('project:' + dir);
    const packagePath = path.join(Const.PACKAGES, dir);
    const packageJsonPath = path.join(packagePath, Const.PK_JSON);
    const isAlive = fs.existsSync(packageJsonPath);
    if (!isAlive) {
        return false;
    }
    else {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        // trace(packageJson.name, packageJson.version)
        const artPatch = path.join(Const.ARTIFACTS, dir);
        return {
            dir,
            artPatch,
            packageJson,
            packagePath,
            changes: [],
            resolveInPackage(name) {
                return path.resolve(path.join(packagePath, name));
            },
            copyToArt(filename) {
                const filePath = (contextDir) => path.join(contextDir, dir, filename);
                copyFileSync(filePath(Const.PACKAGES), filePath(Const.ARTIFACTS));
            },
            savePackageJsonTo: {
                artifacts() {
                    packageJson.repository = "https://github.com/carabins/alak";
                    writeFileSync(path.resolve(artPatch, Const.PK_JSON), JSON.stringify(packageJson, null, 4));
                },
                source() {
                    // path.resolve(packagePath, Const.PK_JSON),
                    const clearJson = pick(packageJson, "name", "version", "description", "keywords");
                    writeFileSync(path.resolve(packagePath, Const.PK_JSON), JSON.stringify(clearJson, null, 4));
                    // JSON.stringify(packageJson, null, 4),
                },
            },
        };
    }
}
//# sourceMappingURL=project.js.map