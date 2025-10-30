import fs from 'fs'
import { Const } from './common/constants.js'
import { initProject, Project } from './common/project.js'

export const versions = {} as Record<string, string>
export const projects = {} as Record<string, Project>

fs.readdirSync(Const.PACKAGES).forEach((f) => {
  const p = initProject(f)
  if (p) {
    p.id = f
    projects[f] = p
    versions[p.packageJson.name] = p.packageJson.version
  }
})
