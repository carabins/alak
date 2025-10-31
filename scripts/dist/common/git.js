import simpleGit from 'simple-git';
import { FileLog } from '~/scripts/log';
import { projects } from '~/scripts/now';
const add = (o, key) => (o[key] = o[key] ? o[key] + 1 : 1);
const changelogFileName = 'CHANGELOG.md';
const git = simpleGit();
export async function getAffected() {
    const trace = FileLog('git');
    const statusResult = await git.status();
    const changes = {};
    const list = statusResult.files.map((f) => {
        const parts = f.path.split('/');
        switch (parts[0]) {
            case 'scripts':
                add(changes, parts[0]);
                break;
            case 'packages':
                add(changes, parts[1]);
                break;
        }
        if (parts.length > 1) {
            const p = projects[parts[1]];
            p && p.changes.push(f);
        }
        return f;
    });
    const affected = Object.keys(changes).filter((s) => s !== 'scripts' && !s.endsWith('.ts'));
    return affected;
}
//# sourceMappingURL=git.js.map