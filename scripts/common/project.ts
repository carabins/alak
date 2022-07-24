import { Const } from './constants'
import * as path from 'path'
import * as fs from 'fs'
import { copyFileSync, writeFileSync } from 'fs'
import { FileLog } from '../log'
import { PackageJson } from 'type-fest'

export type Project = {
  packageJson: PackageJson
  packagePath: string
  artPatch: string
  dir: string
  copyToArt(filename: string)
  resolveInPackage(name: string): string
  savePackageJsonTo: {
    art(): void
    source(): void
  }
}

export function initProject(dir) {
  const trace = FileLog('project:' + dir)
  const packagePath = path.join(Const.PACKAGES, dir)
  const packageJsonPath = path.join(packagePath, Const.PK_JSON)
  const isAlive = fs.existsSync(packageJsonPath)
  if (!isAlive) {
    return false
  } else {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as PackageJson
    trace(packageJson.name, packageJson.version)
    const artPatch = path.join(Const.ARTIFACTS, dir)
    return {
      dir,
      artPatch,
      packageJson,
      packagePath,
      resolveInPackage(name) {
        return path.resolve(path.join(packagePath, name))
      },
      copyToArt(filename: string) {
        const filePath = (contextDir) => path.join(contextDir, dir, filename)
        copyFileSync(filePath(Const.PACKAGES), filePath(Const.ARTIFACTS))
      },
      savePackageJsonTo: {
        art() {
          writeFileSync(path.resolve(artPatch, Const.PK_JSON), JSON.stringify(packageJson, null, 4))
        },
        source() {
          writeFileSync(
            path.resolve(packagePath, Const.PK_JSON),
            JSON.stringify(packageJson, null, 4),
          )
        },
      },
    }
  }
}
