import * as fs from 'fs-extra'
import * as path from 'path'
import { existsSync } from 'fs'

const scan = (dir) => {
  const fromDir = path.resolve(dir)
  const sources = {}
  fs.readdirSync(fromDir).forEach((f) => {
    const fromFile = path.join(fromDir, f)
    const fromFileStats = fs.statSync(fromFile)
    if (fromFileStats.isFile()) {
      const isDeclaration = f.endsWith('.d.ts')
      const name = isDeclaration ? f.replace('.d.ts', '') : f.replace('.ts', '')
      sources[fromFile] = {
        name,
        isDeclaration,
      }
    } else {
      const inSources = scan(path.join(dir, f))
      Object.assign(sources, inSources)
    }
  })
  return sources
}

export function startScan(target) {
  // Log("scan sources...")
  return scan(target)
}

export const scanAllSrc = () => {
  const packagesDir = path.resolve('packages')
  const projects = {}
  const all = []
  fs.readdirSync(packagesDir).forEach((projectDir) => {
    const fromFile = path.join(packagesDir, projectDir)
    const fromFileStats = fs.statSync(fromFile)
    const project = {}

    const scanNext = (nextDir) => {
      if (existsSync(nextDir)) {
        fs.readdirSync(nextDir).forEach((f) => {
          const srcPath = path.resolve(nextDir, f)
          const isDeclaration = f.endsWith('.d.ts')
          const name = isDeclaration ? f.replace('.d.ts', '') : f.replace('.ts', '')
          project[srcPath] = {
            name,
            isDeclaration,
          }
          all.push(srcPath)
        })
      }
    }

    if (!fromFileStats.isFile()) {
      scanNext(path.resolve(packagesDir, projectDir, 'src'))
      scanNext(path.resolve(packagesDir, projectDir, 'types'))
    }
    projects[projectDir] = project
  })
  return { projects, all }
}
