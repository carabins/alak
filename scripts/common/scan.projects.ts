import fs from 'fs'
import {Const} from './common/constants.js'
import {initProjectsInPackagesDir, Project} from './Project'


export const projects = {
  all: {} as Record<string, Project>,
  versions: {} as Record<string, string>
}

fs.readdirSync(Const.PACKAGES).forEach((f) => {
  const p = initProjectsInPackagesDir(f)
  if (p) {
    p.id = f
    projects.all[f] = p
    projects.versions[p.packageJson.name] = p.packageJson.version
  }
})
