import { Project } from '~/scripts/common/project'
import { versions } from '~/scripts/index'
import { FileLog } from '~/scripts/log'

export async function syncDeps(project: Project) {
  const trace = FileLog('sync dependencies for ' + project.dir)
  const deps = project.packageJson.dependencies
  deps &&
    Object.keys(deps).forEach((name) => {
      const nowVersion = versions[name]
      if (nowVersion && deps[name] != nowVersion) {
        trace(`up ${name} to ${nowVersion}`)
        deps[name] = nowVersion
      }
    })
}
