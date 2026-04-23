#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const CRATES_ROOT = path.join(process.cwd(), 'crates')
const REGISTRY = 'valkyrie' // Must be configured in ~/.cargo/config.toml

function main() {
  if (!fs.existsSync(CRATES_ROOT)) {
    console.error('Crates directory not found.')
    process.exit(1)
  }

  const crates = fs.readdirSync(CRATES_ROOT).filter(dir => {
    return fs.existsSync(path.join(CRATES_ROOT, dir, 'Cargo.toml'))
  })

  console.log(`Publishing ${crates.length} crates to registry "${REGISTRY}"...\n`)

  for (const dir of crates) {
    const cratePath = path.join(CRATES_ROOT, dir)
    console.log(`[${dir}] Publishing...`)
    
    // We use --allow-dirty because we might have local changes during dev
    const result = spawnSync('cargo', ['publish', '--registry', REGISTRY, '--allow-dirty'], {
      cwd: cratePath,
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
