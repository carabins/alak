// Test script for PackageJsonGenerator

import { PackageJsonGenerator, detectEntryPoints, readRootPackageJson } from './generators/PackageJsonGenerator'
import * as path from 'path'
import * as fs from 'fs'

async function testQuark() {
  console.log('Testing PackageJsonGenerator for quark...\n')

  const sourceDir = path.join(process.cwd(), 'packages/quark')
  const artifactsDir = path.join(process.cwd(), 'artifacts/quark')

  // Read package.json files
  const sourcePackageJson = JSON.parse(
    fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf-8')
  )
  const rootPackageJson = readRootPackageJson()

  // Detect entry points
  const entryPoints = detectEntryPoints(sourceDir)

  console.log('Detected entry points:')
  entryPoints.forEach(e => {
    console.log(`  - ${e.name} → ${e.exportPath}`)
  })
  console.log()

  // Generate package.json
  const generator = new PackageJsonGenerator({
    sourceDir,
    artifactsDir,
    sourcePackageJson,
    rootPackageJson,
    entryPoints
  })

  const generated = generator.generate()

  console.log('Generated package.json:')
  console.log(JSON.stringify(generated, null, 2))
  console.log()

  // Save to artifacts
  fs.mkdirSync(artifactsDir, { recursive: true })
  fs.writeFileSync(
    path.join(artifactsDir, 'package.json.generated'),
    JSON.stringify(generated, null, 2)
  )

  console.log(`✓ Saved to ${path.join(artifactsDir, 'package.json.generated')}`)
}

async function testNucl() {
  console.log('\n\nTesting PackageJsonGenerator for nucl (v6 with submodules)...\n')

  const sourceDir = path.join(process.cwd(), 'packages/nucl')
  const artifactsDir = path.join(process.cwd(), 'artifacts/nucl')

  if (!fs.existsSync(sourceDir)) {
    console.log('⚠ Nucl package not found, skipping')
    return
  }

  // Read package.json files
  const sourcePackageJson = JSON.parse(
    fs.readFileSync(path.join(sourceDir, 'package.json'), 'utf-8')
  )
  const rootPackageJson = readRootPackageJson()

  // Detect entry points
  const entryPoints = detectEntryPoints(sourceDir)

  console.log('Detected entry points:')
  entryPoints.forEach(e => {
    console.log(`  - ${e.name} → ${e.exportPath}`)
  })
  console.log()

  // Generate package.json
  const generator = new PackageJsonGenerator({
    sourceDir,
    artifactsDir,
    sourcePackageJson,
    rootPackageJson,
    entryPoints
  })

  const generated = generator.generate()

  console.log('Generated package.json:')
  console.log(JSON.stringify(generated, null, 2))
  console.log()

  // Save to artifacts
  fs.mkdirSync(artifactsDir, { recursive: true })
  fs.writeFileSync(
    path.join(artifactsDir, 'package.json.generated'),
    JSON.stringify(generated, null, 2)
  )

  console.log(`✓ Saved to ${path.join(artifactsDir, 'package.json.generated')}`)
}

// Run tests
testQuark()
  .then(() => testNucl())
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })
