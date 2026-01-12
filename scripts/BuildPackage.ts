import {Const} from './common/constants'
import * as path from 'path'
import * as fs from 'fs'
import {PackageJson} from 'type-fest'
import {FileStatusResult} from 'simple-git/dist/typings/response'
import {pick} from './common/utils'
import {createModuleLogger, Log} from "~/scripts/log";

export class BuildPackage {
  id: string
  dir: string
  npmVersion: string
  packageJson: PackageJson
  packagePath: string
  artPatch: string
  state: Record<string, any> = {}
  changes: FileStatusResult[] = []

  constructor(dir: string) {
    this.dir = dir
    this.id = dir
    this.packagePath = path.join(Const.PACKAGES, dir)
    this.artPatch = path.join(Const.ARTIFACTS, dir)

    const pkgPath = path.join(this.packagePath, Const.PK_JSON)
    this.packageJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  }

  #logger
  log(text:string) {
    if (!this.#logger) {
      this.#logger = Log(this.id)
    }
    return this.#logger
  }

  createLogger(name) {
    return createModuleLogger(this.id + ":" + name)
  }

  resolveInPackage(name: string): string {
    return path.resolve(this.packagePath, name)
  }

  copyToArt(filename: string): void {
    const srcPath = path.join(this.packagePath, filename)
    const artPath = path.join(this.artPatch, filename)
    fs.copyFileSync(srcPath, artPath)
  }

  savePackageJsonToSource(): void {
    const clean = pick(this.packageJson, 'name', 'version', 'description', 'keywords')
    const srcPath = path.resolve(this.packagePath, Const.PK_JSON)
    fs.writeFileSync(srcPath, JSON.stringify(clean, null, 2))
  }
}

export function initProjectsInPackagesDir(dir: string): BuildPackage | null {
  const pkgPath = path.join(Const.PACKAGES, dir, Const.PK_JSON)
  if (!fs.existsSync(pkgPath)) {
    return null
  }
  return new BuildPackage(dir)
}
