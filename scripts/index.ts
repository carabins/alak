/**
 * New Build System CLI
 * Step-by-step incremental build pipeline
 */

import select from '@inquirer/select'
import checkbox from '@inquirer/checkbox'
import * as path from 'path'
import * as fs from 'fs'

// ASCII art logo
const LOGO = `
      o
       o
     ___
     | |
     | |
     |o|
    .' '.
   /  o  \\
  :____o__:
  '._____.'
`

/**
 * V6 packages ready for build
 */
const V6_PACKAGES = ['quark', 'nucl', 'rune'] as const

async function main() {
  console.clear()
  console.log(LOGO)

  // Quick commands
  const quickCommand = process.argv[2]
  if (quickCommand === 'gen-pkg') {
    return await generatePackageJson()
  }

  // Main menu
  const task = await select({
    message: 'Select a task',
    choices: [
      {
        name: 'Generate package.json',
        description: 'Auto-generate package.json for v6 packages',
        value: 'gen-pkg'
      },
      {
        name: 'Test (old system)',
        description: 'Run tests using existing test runner',
        value: 'test-old'
      },
    ]
  })

  switch (task) {
    case 'gen-pkg':
      await generatePackageJson()
      break
    case 'test-old':
      await runOldTests()
      break
  }
}

/**
 * Generate package.json for v6 packages
 */
async function generatePackageJson() {
  console.log('\n📦 Generating package.json for v6 packages...\n')

  // Import generator
  const { PackageJsonGenerator, detectEntryPoints, readRootPackageJson } = await import('./generators/PackageJsonGenerator')

  for (const pkgName of V6_PACKAGES) {
    const sourceDir = path.join(process.cwd(), 'packages', pkgName)
    const artifactsDir = path.join(process.cwd(), 'artifacts', pkgName)

    if (!fs.existsSync(sourceDir)) {
      console.log(`⚠️  ${pkgName}: package not found, skipping`)
      continue
    }

    const sourcePackageJsonPath = path.join(sourceDir, 'package.json')
    if (!fs.existsSync(sourcePackageJsonPath)) {
      console.log(`⚠️  ${pkgName}: package.json not found, skipping`)
      continue
    }

    // Read source package.json
    const sourcePackageJson = JSON.parse(
      fs.readFileSync(sourcePackageJsonPath, 'utf-8')
    )
    const rootPackageJson = readRootPackageJson()

    // Detect entry points
    const entryPoints = detectEntryPoints(sourceDir)

    console.log(`📦 ${pkgName}:`)
    console.log(`   Entry points: ${entryPoints.map(e => e.exportPath).join(', ')}`)

    // Generate package.json
    const generator = new PackageJsonGenerator({
      sourceDir,
      artifactsDir,
      sourcePackageJson,
      rootPackageJson,
      entryPoints
    })

    const generated = generator.generate()

    // Save to artifacts
    fs.mkdirSync(artifactsDir, { recursive: true })
    fs.writeFileSync(
      path.join(artifactsDir, 'package.json'),
      JSON.stringify(generated, null, 2)
    )

    console.log(`   ✅ Saved to artifacts/${pkgName}/package.json\n`)
  }

  console.log('✅ All package.json files generated!')
}

/**
 * Run old test system
 */
async function runOldTests() {
  console.log('\n🧪 Running tests with old system...\n')

  // Import old test runner
  const { testProjects } = await import('./tasks/task.test')

  // Load old projects config
  const { projects } = await import('./now')
  const allProjects = Object.values(projects)

  await testProjects(allProjects)
}

// Run CLI
main().catch((error) => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
