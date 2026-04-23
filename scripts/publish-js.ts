#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const ARTIFACTS_ROOT = path.join(process.cwd(), 'artifacts')
const REGISTRY = 'https://js.valkyrie.rest'

function main() {
  if (!fs.existsSync(ARTIFACTS_ROOT)) {
    console.error('Artifacts directory not found. Run build first.')
    process.exit(1)
  }

  const packages = fs.readdirSync(ARTIFACTS_ROOT).filter(dir => {
    return fs.existsSync(path.join(ARTIFACTS_ROOT, dir, 'package.json'))
  })

  console.log(`Publishing ${packages.length} packages to ${REGISTRY}...\n`)

  for (const dir of packages) {
    const pkgPath = path.join(ARTIFACTS_ROOT, dir)
    console.log(`[${dir}] Publishing...`)
    
    const result = spawnSync('npm', ['publish', '--registry', REGISTRY, '--tag', 'alpha', '--userconfig', path.join(process.cwd(), '.npmrc.publish')], {
      cwd: pkgPath,
      stdio: 'inherit',
      shell: true
    })

    if (result.status !== 0) {
      console.error(`  ❌ Failed to publish ${dir}`)
    } else {
      console.log(`  ✅ Published ${dir}`)
    }
  }
}

main()
