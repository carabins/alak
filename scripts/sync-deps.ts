#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import * as YAML from 'yaml'

const PACKAGES_ROOT = path.join(process.cwd(), 'packages')

function main() {
  const packages = fs.readdirSync(PACKAGES_ROOT).filter(dir => {
    return fs.existsSync(path.join(PACKAGES_ROOT, dir, 'package.yaml'))
  })

  const versionMap: Record<string, string> = {}
  const packagePaths: Record<string, string> = {}

  // Phase 1: Build Map
  for (const dir of packages) {
    const pkgPath = path.join(PACKAGES_ROOT, dir, 'package.yaml')
    const content = fs.readFileSync(pkgPath, 'utf8')
    const yaml = YAML.parse(content)
    
    if (yaml.name && yaml.version) {
      versionMap[yaml.name] = yaml.version
      packagePaths[yaml.name] = pkgPath
    }
  }

  console.log(`Found ${Object.keys(versionMap).length} alaq packages.`)

  let totalUpdated = 0

  // Phase 2: Update Dependencies
  for (const [pkgName, pkgPath] of Object.entries(packagePaths)) {
    const content = fs.readFileSync(pkgPath, 'utf8')
    const yaml = YAML.parse(content)
    let changed = false

    const updateSection = (sectionName: string) => {
      if (!yaml[sectionName]) return
      
      for (const [depName, currentRange] of Object.entries(yaml[sectionName])) {
        if (versionMap[depName]) {
          const targetVersion = versionMap[depName]
          if (currentRange !== targetVersion) {
            console.log(`  [${pkgName}] updating ${depName}: ${currentRange} -> ${targetVersion}`)
            yaml[sectionName][depName] = targetVersion
            changed = true
            totalUpdated++
          }
        }
      }
    }

    updateSection('dependencies')
    updateSection('devDependencies')
    updateSection('peerDependencies')

    if (changed) {
      fs.writeFileSync(pkgPath, YAML.stringify(yaml))
    }
  }

  if (totalUpdated > 0) {
    console.log(`\nDone! Updated ${totalUpdated} dependency entries.`)
  } else {
    console.log('\nAll internal dependencies are up to date.')
  }
}

main()
