import { FileLog } from '../log';
const { Worker } = require('node:worker_threads');
function pick(obj, ...keys) {
    const result = {};
    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key];
        }
    }
    return result;
}
export async function check(t) {
    const log = FileLog('dev');
    const marked = {};
    const clearJson = pick(t.packageJson, "name", "version", "description", "keywords", "dependencies");
}
//# sourceMappingURL=task.check.js.map