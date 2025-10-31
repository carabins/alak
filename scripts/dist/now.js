import fs from 'fs';
import { Const } from './common/constants.js';
import { initProject } from './common/project.js';
export const versions = {};
export const projects = {};
fs.readdirSync(Const.PACKAGES).forEach((f) => {
    const p = initProject(f);
    if (p) {
        p.id = f;
        projects[f] = p;
        versions[p.packageJson.name] = p.packageJson.version;
    }
});
//# sourceMappingURL=now.js.map