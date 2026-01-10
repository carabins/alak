import { Project } from '~/scripts/common/project'

import { FileLog } from '~/scripts/log'
import { versions } from '~/scripts/now'

export async function syncDeps(project: Project) {
  const log = FileLog('sync dependencies for ' + project.dir)
  const deps = project.packageJson.dependencies
  deps &&
    Object.keys(deps).forEach((name) => {
      const nowVersion = versions[name]
      if (nowVersion && deps[name] != nowVersion) {
        log(`up ${name} to ${nowVersion}`)
        deps[name] = nowVersion
      }
    })
}
