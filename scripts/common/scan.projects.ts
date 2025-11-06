import fs from 'fs'
import {Const} from './constants'
import {initProjectsInPackagesDir, BuildPackage} from '../BuildPackage'


export const packageRegistry = {
  all: {} as Record<string, BuildPackage>,
  versions: {} as Record<string, string>
}

fs.readdirSync(Const.PACKAGES).forEach((f) => {
  const p = initProjectsInPackagesDir(f)
  if (p) {
    p.id = f
    packageRegistry.all[f] = p
    packageRegistry.versions[p.packageJson.name] = p.packageJson.version
  }
})
